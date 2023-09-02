export class File extends Blob {
  /**
   * @param {BlobPart[] | undefined} content
   * @param {BlobPropertyBag | undefined} options
   */
  constructor(content, options) {
    super(content, options);
    this.name = "file";
    this.lastModified = new Date().getMilliseconds();
  }
}
