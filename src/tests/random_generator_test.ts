import { generateRandom } from '../random'

const main = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    const result = generateRandom(10)
    console.log('result: ', result)
  }

  for (let i = 0; i < 10; i++) {
    const result = generateRandom(8, true)
    console.log('result: ', result)
  }
}

main().catch(console.error)
