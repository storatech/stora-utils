import { hashUtils } from "../hash"

const main = async (): Promise<void> => {
  const result = hashUtils.hash('hello')
  console.log('result:', result);
}

main().catch(console.log)