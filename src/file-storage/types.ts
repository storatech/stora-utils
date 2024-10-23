export interface S3Config {
  bucket: string
  cdnPath: string
}


export interface FileStorage {
  listFiles: (path: string, filter: any) => Promise<string[]>
  getFile: (path: string) => Promise<Buffer>
  uploadFile: (path: string, name: string, data: Buffer, contentType: string) => Promise<string>
  deleteFile: (path: string) => Promise<void>
}
