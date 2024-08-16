const Transliterate = (word: string): string => {
  let resultWord = ''
  const a: any = {
    Ё: 'Yo',
    Й: 'I',
    Ц: 'Ts',
    У: 'U',
    Ү: 'U',
    К: 'K',
    Е: 'E',
    Н: 'N',
    Г: 'G',
    Ш: 'Sh',
    Щ: 'SCH',
    З: 'Z',
    Х: 'H',
    Ъ: 'i',
    ё: 'yo',
    й: 'i',
    ц: 'ts',
    у: 'u',
    ү: 'u',
    к: 'k',
    е: 'e',
    н: 'n',
    г: 'g',
    ш: 'sh',
    щ: 'sch',
    з: 'z',
    х: 'h',
    ъ: 'i',
    Ф: 'F',
    Ы: 'Ii',
    В: 'V',
    А: 'A',
    П: 'P',
    Р: 'R',
    О: 'O',
    Ө: 'U',
    Л: 'L',
    Д: 'D',
    Ж: 'J',
    Э: 'E',
    ф: 'f',
    ы: 'ii',
    в: 'v',
    а: 'a',
    п: 'p',
    р: 'r',
    о: 'o',
    ө: 'u',
    л: 'l',
    д: 'd',
    ж: 'j',
    э: 'e',
    Я: 'Ya',
    Ч: 'Ch',
    С: 'S',
    М: 'M',
    И: 'I',
    Т: 'T',
    Ь: 'i',
    Б: 'B',
    Ю: 'Yu',
    я: 'ya',
    ч: 'ch',
    с: 's',
    м: 'm',
    и: 'i',
    т: 't',
    ь: 'i',
    б: 'b',
    ю: 'yu'
  }

  const s: any = { Я: 'Y', я: 'y', Ё: 'Y', ё: 'y', Е: 'Y', е: 'y', Ю: 'Y', ю: 'y' }

  const e = ['а', 'А', 'э', 'Э', 'ү', 'Ү', 'Ө', 'ө', 'о', 'О', 'у', 'У']

  for (let i = 0; i < word.length; i++) {
    if (word[i] !== undefined) {
      if (s[word[i]] !== undefined && e.includes(word[i + 1])) {
        resultWord += String(s[word[i]])
      } else {
        if (a[word[i]] !== undefined) {
          resultWord += String(a[word[i]])
        } else {
          resultWord += word[i]
        }
      }
    }
  }

  return resultWord
}

export default Transliterate
