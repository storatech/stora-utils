export interface S3Config {
  bucket: string
}

export interface FileStorage {
  listFiles: (path: string, filter: any) => Promise<string[]>
  getFile: (path: string) => Promise<Buffer>
  uploadFile: (path: string, name: string, data: Buffer) => Promise<void>
  deleteFile: (path: string) => Promise<void>
}
