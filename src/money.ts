export type ICurrency = 'USD' | 'MNT' | 'USc'

export interface IStringMoney {
  amount: string
  currency: ICurrency
}

export interface IMoney extends Omit<IStringMoney, 'amount'> {
  amount: number | string
}

export interface IMoneyCalculator {
  amount: (a: IMoney) => number
  new: (a: number | string, currency?: ICurrency) => IMoney
  convert: (a: IMoney, currency?: ICurrency) => IMoney
  add: (a: IMoney | undefined, b: IMoney | undefined) => IMoney
  sum: (...a: Array<IMoney | undefined>) => IMoney
  sub: (a: IMoney, b: IMoney) => IMoney
  multi: (a: IMoney, b: number) => IMoney
  parse: (a: string, currency?: ICurrency) => IMoney
  format: (a: IMoney, currency?: ICurrency) => string
}

export interface ICurrencyRate {
  /** MNT_USD => 1MNT = XUSD */
  rate: number
  buyRate: number
  sellRate: number
}

interface ICurrencyTransformer {
  format: (money: IMoney) => string
  parse: (money: string) => IMoney
}

interface ICurrencyDefinition {
  name: string
  symbol: string
  currency: ICurrency
  precision: number
  transformer: ICurrencyTransformer
}

const toNumber = (a: string | number): number => {
  if (typeof a === 'number') {
    return a
  } else {
    return parseFloat(a)
  }
}

export const CURRENCIES: Record<ICurrency, ICurrencyDefinition> = {
  USD: {
    name: 'U.S. Dollar',
    currency: 'USD',
    symbol: '$',
    precision: 2,
    transformer: {
      format: (money) => {
        return toNumber(money.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: CURRENCIES.USD.precision, maximumFractionDigits: CURRENCIES.USD.precision })
      },
      parse: (money) => {
        const def = CURRENCIES.USD
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.]/gi, '')
          if (amount.match(/^\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculator({}, def.currency).new(amount)
          }
        }
        throw new Error('parse error')
      }
    }
  },
  MNT: {
    name: 'Mongolian Tugrik',
    currency: 'MNT',
    symbol: '₮',
    precision: 0,
    transformer: {
      format: (money) => {
        if (typeof money.amount === 'string') {
          return `₮${parseFloat(money.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        } else if (typeof money.amount === 'number') {
          return `₮${money.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        }
        throw new Error('unknown amount')
      },
      parse: (money) => {
        const def = CURRENCIES.MNT
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.]/gi, '')
          if (amount.match(/^\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculator({}, def.currency).new(amount)
          }
        }
        throw new Error('parse error')
      }
    }
  },
  USc: {
    name: 'U.S. Cent',
    currency: 'USc',
    symbol: '¢',
    precision: 0,
    transformer: {
      format: (money) => {
        return (toNumber(money.amount) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: CURRENCIES.USD.precision, maximumFractionDigits: CURRENCIES.USD.precision })
      },
      parse: (money) => {
        const def = CURRENCIES.USc
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.]/gi, '')
          if (amount.match(/^\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculator({}, 'USD').new(toNumber(amount) / 100)
          }
        }
        throw new Error('parse error')
      }
    }
  }
}

export const MoneyCalculator = (currencyRates: Record<string, ICurrencyRate>, base: ICurrency = 'MNT'): IMoneyCalculator => {
  const calculator: IMoneyCalculator = {
    amount: (a) => {
      return toNumber(a.amount)
    },
    new: (a, currency = base) => {
      const { precision } = CURRENCIES[currency]
      const precisionAdj = Math.pow(10, precision)
      const amount = Math.round(toNumber(a) * precisionAdj) / precisionAdj
      return {
        amount,
        currency
      }
    },
    convert: (a, currency = base) => {
      const { ...b } = a
      if (a.currency === currency) {
        return b
      } else {
        const rate = `${a.currency}_${currency}`
        const currencyRate = currencyRates[rate]
        const { precision } = CURRENCIES[currency]
        if (currencyRate === undefined) {
          throw new Error(`currency rate not found ${rate}`)
        }
        const { sellRate } = currencyRate
        const precisionAdj = Math.pow(10, precision)
        const amount = Math.round(sellRate * toNumber(a.amount) * precisionAdj) / precisionAdj
        return {
          amount,
          currency
        }
      }
    },
    add: (a, b) => {
      if (a === undefined || b === undefined) {
        return a ?? b ?? calculator.new(0)
      }
      if (a.currency === b.currency) {
        return {
          amount: toNumber(a.amount) + toNumber(b.amount),
          currency: a.currency
        }
      } else {
        const x = calculator.convert(a)
        const y = calculator.convert(b)
        return {
          amount: toNumber(x.amount) + toNumber(y.amount),
          currency: x.currency
        }
      }
    },
    sum: (...a) => {
      const [c, ...rest] = a
      return rest.reduce((r, b) => {
        return calculator.add(r, b)
      }, c) ?? calculator.new(0)
    },
    sub: (a, b) => {
      if (a.currency === b.currency) {
        return {
          amount: toNumber(a.amount) - toNumber(b.amount),
          currency: a.currency
        }
      } else {
        const x = calculator.convert(a)
        const y = calculator.convert(b)
        return {
          amount: toNumber(x.amount) - toNumber(y.amount),
          currency: x.currency
        }
      }
    },
    multi: (a, b) => {
      return {
        amount: toNumber(a.amount) * b,
        currency: a.currency
      }
    },
    parse: (money, currency) => {
      const currencies = currency === undefined ? Object.values(CURRENCIES) : [CURRENCIES[currency]]
      for (const def of currencies) {
        if (def !== undefined) {
          try {
            return def.transformer.parse(money)
          } catch (e) {
          }
        }
      }
      throw new Error('cant parse')
    },
    format: (money, currency) => {
      if (currency !== undefined && money.currency !== currency) {
        money = calculator.convert(money, currency)
      }
      const def = CURRENCIES[money.currency]
      return def.transformer.format(money)
    }
  }
  return calculator
}

// const test = (): void => {
//   const rates = {
//     MNT_USD: {
//       _id: 'USD_MNT',
//       adjustmentCoeff: 1,
//       buyRate: 2844,
//       fetchedAt: new Date(),
//       rate: 2849.04,
//       sellRate: 2851
//     }
//   }
//   const money = MoneyCalculator(rates, 'MNT')
//   console.log(MoneyCalculator({}).parse('$100,000.001'))
//   const res = money.sum({
//     amount: '1.321321321',
//     currency: 'MNT'
//   }, money.new(0))
//   console.log(money.format(res))
// }

// test()
