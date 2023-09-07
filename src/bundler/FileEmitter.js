import { createHash } from "crypto"
import { LOGLEVEL_WARN } from "./logging.js"
import { extname } from "path"

const error = console.error.bind(console)

/**
 * @param {Map<any, any>} map
 * @param {string | number} key
 * @param {{ (): any[]; (): any; }} init
 */
export function getOrCreate(map, key, init) {
    const existing = map.get(key)
    if (existing !== undefined) {
      return existing
    }
    const value = init()
    map.set(key, value)
    return value
  }

/**
 * @param {any} source
 */
function getSourceHash(source) {
    // err
  return createHash('sha256')
    .update(source)
    .digest("hex")
}

/**
 * @param {any} name
 * @param {any} source
 * @param {string | any[]} sourceHash
 * @param {{ sanitizeFileName: (arg0: any) => any; assetFileNames: (arg0: { name: any; source: any; type: string; }) => any; }} outputOptions
 * @param {any} bundle
 */
function generateAssetFileName(
  name,
  source,
  sourceHash,
  outputOptions,
  bundle
) {
  const emittedName = outputOptions.sanitizeFileName(name || "asset")
  return (
    (
      typeof outputOptions.assetFileNames === "function"
        ? outputOptions.assetFileNames({ name, source, type: "asset" })
        : outputOptions.assetFileNames,
      "output.assetFileNames",
      {
        ext: () => extname(emittedName).slice(1),
        extname: () => extname(emittedName),
        hash: (/** @type {any} */ size) => sourceHash.slice(0, Math.max(0, size || 2)),//defaultHashSize)),
        name: () =>
          emittedName.slice(
            0,
            Math.max(0, emittedName.length - extname(emittedName).length)
          )
      }
    ),
    bundle
  )
}

const emittedFileTypes = new Set(["chunk", "asset", "prebuilt-chunk"])

/**
 * @param {{ type: string; }} emittedFile
 */
function hasValidType(emittedFile) {
  return Boolean(emittedFile && emittedFileTypes.has(emittedFile.type))
}

/**
 * @param {{ fileName: any; name: any; }} emittedFile
 */
function hasValidName(emittedFile) {
  const validatedName = emittedFile.fileName || emittedFile.name
  return (
    !validatedName ||
    (typeof validatedName === "string" )
  )
}

/**
 * @param {any} source
 * @param {{ fileName: any; name: any; }} emittedFile
 * @param {null} fileReferenceId
 */
function getValidSource(source, emittedFile, fileReferenceId) {
  if (!(typeof source === "string" || source instanceof Uint8Array)) {
    const assetName =
      emittedFile.fileName || emittedFile.name || fileReferenceId
    return error(
      'logFailedValidation',
        `Could not set source for ${
          typeof assetName === "string"
            ? `asset "${assetName}"`
            : "unnamed asset"
        }, asset source needs to be a string, Uint8Array or Buffer.`
      
    )
  }
  return source
}

/**
 * @param {{ fileName: any; name: any; }} file
 * @param {any} referenceId
 */
function getAssetFileName(file, referenceId) {
  if (typeof file.fileName !== "string") {
    return error('logAssetNotFinalisedForFileName',file.name || referenceId)
  }
  return file.fileName
}

/**
 * @param {{ fileName: any; module: any; name: any; }} file
 * @param {{ get: (arg0: any) => { (): any; new (): any; getFileName: { (): any; new (): any; }; }; } | null} facadeChunkByModule
 */
function getChunkFileName(file, facadeChunkByModule) {
  if (file.fileName) {
    return file.fileName
  }
  if (facadeChunkByModule) {
    return facadeChunkByModule.get(file.module).getFileName()
  }
  return error('logChunkNotGeneratedForFileName',file.fileName || file.name)
}

export class FileEmitter {
  facadeChunkByModule = null
  nextIdBase = 1
  output = null
  /**
     * @type {any[]}
     */
  outputFileEmitters = []

  /**
     * @param {any} graph
     * @param {any} options
     */
  // @ts-ignore
  constructor(graph, options, baseFileEmitter) {
    this.graph = graph
    this.options = options
    this.filesByReferenceId = baseFileEmitter
      ? new Map(baseFileEmitter.filesByReferenceId)
      : new Map()
    baseFileEmitter?.addOutputFileEmitter(this)
  }

  // @ts-ignore
  emitFile = (emittedFile) => {
    if (!hasValidType(emittedFile)) {
      return error(
        
          `Emitted files must be of type "asset", "chunk" or "prebuilt-chunk", received "${emittedFile &&
            emittedFile.type}".`
        
      )
    }
    if (emittedFile.type === "prebuilt-chunk") {
      return this.emitPrebuiltChunk(emittedFile)
    }
    if (!hasValidName(emittedFile)) {
      return error(
        
          `The "fileName" or "name" properties of emitted chunks and assets must be strings that are neither absolute nor relative paths, received "${emittedFile.fileName ||
            emittedFile.name}".`
        
      )
    }
    if (emittedFile.type === "chunk") {
      return this.emitChunk(emittedFile)
    }
    return this.emitAsset(emittedFile)
  }

  finaliseAssets = () => {
    for (const [referenceId, emittedFile] of this.filesByReferenceId) {
      if (
        emittedFile.type === "asset" &&
        typeof emittedFile.fileName !== "string"
      )
        return error('logNoAssetSourceSet', emittedFile.name || referenceId)
    }
  }

  getFileName = (/** @type {any} */ fileReferenceId) => {
    const emittedFile = this.filesByReferenceId.get(fileReferenceId)
    if (!emittedFile)
      return error('logFileReferenceIdNotFoundForFilename',fileReferenceId)
    if (emittedFile.type === "chunk") {
      return getChunkFileName(emittedFile, this.facadeChunkByModule)
    }
    if (emittedFile.type === "prebuilt-chunk") {
      return emittedFile.fileName
    }
    return getAssetFileName(emittedFile, fileReferenceId)
  }

  setAssetSource = (/** @type {any} */ referenceId, /** @type {any} */ requestedSource) => {
    const consumedFile = this.filesByReferenceId.get(referenceId)
    if (!consumedFile)
      return error('logAssetReferenceIdNotFoundForSetSource', referenceId)
    if (consumedFile.type !== "asset") {
      return error(
        'logFailedValidation',
          `Asset sources can only be set for emitted assets but "${referenceId}" is an emitted chunk.`
      )
    }
    if (consumedFile.source !== undefined) {
      return error('logAssetSourceAlreadySet',consumedFile.name || referenceId)
    }
    const source = getValidSource(requestedSource, consumedFile, referenceId)
    if (this.output) {
      this.finalizeAdditionalAsset(consumedFile, source, this.output)
    } else {
      consumedFile.source = source
      for (const emitter of this.outputFileEmitters) {
        emitter.finalizeAdditionalAsset(consumedFile, source, emitter.output)
      }
    }
  }

  setChunkInformation = (/** @type {null} */ facadeChunkByModule) => {
    this.facadeChunkByModule = facadeChunkByModule
  }

  setOutputBundle = (/** @type {any} */ bundle, /** @type {any} */ outputOptions) => {
    // @ts-ignore
    const output = (this.output = {
      bundle,
      fileNamesBySource: new Map(),
      outputOptions
    })
    for (const emittedFile of this.filesByReferenceId.values()) {
      if (emittedFile.fileName) {
        // reserveFileNameInBundle(
        //   emittedFile.fileName,
        //   output,
        //   this.options.onLog
        // )
      }
    }
    const consumedAssetsByHash = new Map()
    for (const consumedFile of this.filesByReferenceId.values()) {
      if (consumedFile.type === "asset" && consumedFile.source !== undefined) {
        if (consumedFile.fileName) {
          this.finalizeAdditionalAsset(
            consumedFile,
            consumedFile.source,
            output
          )
        } else {
          const sourceHash = getSourceHash(consumedFile.source)
          getOrCreate(consumedAssetsByHash, sourceHash, () => []).push(
            consumedFile
          )
        }
      } else if (consumedFile.type === "prebuilt-chunk") {
        // @ts-ignore
        this.output.bundle[consumedFile.fileName] = this.createPrebuiltChunk(
          consumedFile
        )
      }
    }
    for (const [sourceHash, consumedFiles] of consumedAssetsByHash) {
      this.finalizeAssetsWithSameSource(consumedFiles, sourceHash, output)
    }
  }

  /**
     * @param {any} outputFileEmitter
     */
  addOutputFileEmitter(outputFileEmitter) {
    this.outputFileEmitters.push(outputFileEmitter)
  }

  /**
     * @param {{ fileName?: any; name?: any; needsCodeReference?: boolean; referenceId: any; source?: string | void | Uint8Array; type?: string; module?: null; code?: any; exports?: any; map?: any; }} file
     * @param {any} idBase
     */
  assignReferenceId(file, idBase) {
    let referenceId = idBase

    do {
        // err
      referenceId = crypto.subtle.digest('')
        .update(referenceId)
        .digest("hex")
        .slice(0, 8)
    } while (
      this.filesByReferenceId.has(referenceId) ||
      this.outputFileEmitters.some(({ filesByReferenceId }) =>
        filesByReferenceId.has(referenceId)
      )
    )
    file.referenceId = referenceId
    this.filesByReferenceId.set(referenceId, file)
    for (const { filesByReferenceId } of this.outputFileEmitters) {
      filesByReferenceId.set(referenceId, file)
    }
    return referenceId
  }

  /**
     * @param {{ code: any; exports: any; fileName: any; map: any; referenceId?: string; type?: string; sourcemapFileName?: any; }} prebuiltChunk
     */
  createPrebuiltChunk(prebuiltChunk) {
    return {
      code: prebuiltChunk.code,
      dynamicImports: [],
      exports: prebuiltChunk.exports || [],
      facadeModuleId: null,
      fileName: prebuiltChunk.fileName,
      implicitlyLoadedBefore: [],
      importedBindings: {},
      imports: [],
      isDynamicEntry: false,
      isEntry: false,
      isImplicitEntry: false,
      map: prebuiltChunk.map || null,
      moduleIds: [],
      modules: {},
      name: prebuiltChunk.fileName,
      preliminaryFileName: prebuiltChunk.fileName,
      referencedFiles: [],
      sourcemapFileName: prebuiltChunk.sourcemapFileName || null,
      type: "chunk"
    }
  }

  /**
     * @param {{ source: undefined; fileName: any; name: any; needsCodeReference: any; }} emittedAsset
     */
  emitAsset(emittedAsset) {
    const source =
      emittedAsset.source === undefined
        ? undefined
        : getValidSource(emittedAsset.source, emittedAsset, null)
    const consumedAsset = {
      fileName: emittedAsset.fileName,
      name: emittedAsset.name,
      needsCodeReference: !!emittedAsset.needsCodeReference,
      referenceId: "",
      source,
      type: "asset"
    }
    const referenceId = this.assignReferenceId(
      consumedAsset,
      emittedAsset.fileName || emittedAsset.name || String(this.nextIdBase++)
    )
    if (this.output) {
      this.emitAssetWithReferenceId(consumedAsset, this.output)
    } else {
      for (const fileEmitter of this.outputFileEmitters) {
        fileEmitter.emitAssetWithReferenceId(consumedAsset, fileEmitter.output)
      }
    }
    return referenceId
  }

  /**
     * @param {{ fileName: any; name?: any; needsCodeReference?: boolean; referenceId?: string; source: any; type?: string; }} consumedAsset
     * @param {never} output
     */
  emitAssetWithReferenceId(consumedAsset, output) {
    const { fileName, source } = consumedAsset
    if (fileName) {
      reserveFileNameInBundle(fileName, output, this.options.onLog)
    }
    if (source !== undefined) {
      this.finalizeAdditionalAsset(consumedAsset, source, output)
    }
  }

  /**
     * @param {{ id: any; fileName: any; name: any; }} emittedChunk
     */
  emitChunk(emittedChunk) {
    if (this.graph.phase > BuildPhase.LOAD_AND_PARSE) {
      return error(logInvalidRollupPhaseForChunkEmission())
    }
    if (typeof emittedChunk.id !== "string") {
      return error(
        logFailedValidation(
          `Emitted chunks need to have a valid string id, received "${emittedChunk.id}"`
        )
      )
    }
    const consumedChunk = {
      fileName: emittedChunk.fileName,
      module: null,
      name: emittedChunk.name || emittedChunk.id,
      referenceId: "",
      type: "chunk"
    }
    this.graph.moduleLoader
      .emitChunk(emittedChunk)
      .then((/** @type {null} */ module) => (consumedChunk.module = module))
      .catch(() => {
        // Avoid unhandled Promise rejection as the error will be thrown later
        // once module loading has finished
      })

    return this.assignReferenceId(consumedChunk, emittedChunk.id)
  }

  /**
     * @param {{ code: any; fileName: any; exports: any; map: any; }} emitPrebuiltChunk
     */
  emitPrebuiltChunk(emitPrebuiltChunk) {
    if (typeof emitPrebuiltChunk.code !== "string") {
      return error(
        logFailedValidation(
          `Emitted prebuilt chunks need to have a valid string code, received "${emitPrebuiltChunk.code}".`
        )
      )
    }
    if (
      typeof emitPrebuiltChunk.fileName !== "string" ||
      isPathFragment(emitPrebuiltChunk.fileName)
    ) {
      return error(
        logFailedValidation(
          `The "fileName" property of emitted prebuilt chunks must be strings that are neither absolute nor relative paths, received "${emitPrebuiltChunk.fileName}".`
        )
      )
    }
    const consumedPrebuiltChunk = {
      code: emitPrebuiltChunk.code,
      exports: emitPrebuiltChunk.exports,
      fileName: emitPrebuiltChunk.fileName,
      map: emitPrebuiltChunk.map,
      referenceId: "",
      type: "prebuilt-chunk"
    }
    const referenceId = this.assignReferenceId(
      consumedPrebuiltChunk,
      consumedPrebuiltChunk.fileName
    )
    if (this.output) {
      this.output.bundle[
        consumedPrebuiltChunk.fileName
      ] = this.createPrebuiltChunk(consumedPrebuiltChunk)
    }
    return referenceId
  }

  /**
     * @param {{ name?: any; fileName?: any; needsCodeReference?: any; referenceId?: any; }} consumedFile
     * @param {string | void | Uint8Array} source
     */
  finalizeAdditionalAsset(
    consumedFile,
    source,
    // @ts-ignore
    { bundle, fileNamesBySource, outputOptions }
  ) {
    let { fileName, needsCodeReference, referenceId } = consumedFile

    // Deduplicate assets if an explicit fileName is not provided
    if (!fileName) {
      const sourceHash = getSourceHash(source)
      fileName = fileNamesBySource.get(sourceHash)
      if (!fileName) {
        fileName = generateAssetFileName(
          consumedFile.name,
          source,
          sourceHash,
          outputOptions,
          bundle
        )
        fileNamesBySource.set(sourceHash, fileName)
      }
    }

    // We must not modify the original assets to avoid interaction between outputs
    const assetWithFileName = { ...consumedFile, fileName, source }
    this.filesByReferenceId.set(referenceId, assetWithFileName)

    const existingAsset = bundle[fileName]
    if (existingAsset?.type === "asset") {
      existingAsset.needsCodeReference &&= needsCodeReference
    } else {
      bundle[fileName] = {
        fileName,
        name: consumedFile.name,
        needsCodeReference,
        source,
        type: "asset"
      }
    }
  }

  /**
     * @param {any} consumedFiles
     * @param {any} sourceHash
     */
  finalizeAssetsWithSameSource(
    consumedFiles,
    sourceHash,
    // @ts-ignore
    { bundle, fileNamesBySource, outputOptions }
  ) {
    let fileName = ""
    let usedConsumedFile
    let needsCodeReference = true
    for (const consumedFile of consumedFiles) {
      needsCodeReference &&= consumedFile.needsCodeReference
      const assetFileName = generateAssetFileName(
        consumedFile.name,
        consumedFile.source,
        sourceHash,
        outputOptions,
        bundle
      )
      if (
        !fileName ||
        assetFileName.length < fileName.length ||
        (assetFileName.length === fileName.length && assetFileName < fileName)
      ) {
        fileName = assetFileName
        usedConsumedFile = consumedFile
      }
    }
    fileNamesBySource.set(sourceHash, fileName)

    for (const consumedFile of consumedFiles) {
      // We must not modify the original assets to avoid interaction between outputs
      const assetWithFileName = { ...consumedFile, fileName }
      this.filesByReferenceId.set(consumedFile.referenceId, assetWithFileName)
    }

    bundle[fileName] = {
      fileName,
      name: usedConsumedFile.name,
      needsCodeReference,
      source: usedConsumedFile.source,
      type: "asset"
    }
  }
}
