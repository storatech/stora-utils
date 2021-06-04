export type ICurrency = 'USD' | 'MNT'

export interface IStringMoney {
  amount: string
  currency: ICurrency
}

export interface IMoney extends Omit<IStringMoney, 'amount'> {
  amount: number | string
}

export interface IMoneyCalculator {

  new: (a: number, currency?: ICurrency) => IMoney
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

export const CURRENCIES: Record<ICurrency, { name: string, symbol: string, currency: ICurrency, precision: number }> = {
  USD: {
    name: 'U.S. Dollar',
    currency: 'USD',
    symbol: '$',
    precision: 2
  },
  MNT: {
    name: 'Mongolian Tugrik',
    currency: 'MNT',
    symbol: '₮',
    precision: 0
  }
}

export const MoneyCalculator = (currencyRates: Record<string, ICurrencyRate>, base: ICurrency = 'MNT'): IMoneyCalculator => {
  const fix = (a: string | number): number => {
    if (typeof a === 'number') {
      return a
    } else {
      return parseFloat(a)
    }
  }
  const calculator: IMoneyCalculator = {
    new: (a, currency = base) => {
      const { precision } = CURRENCIES[currency]
      const precisionAdj = Math.pow(10, precision)
      const amount = Math.round(a * precisionAdj) / precisionAdj
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
        const rate = `${currency}_${a.currency}`
        const currencyRate = currencyRates[rate]
        const { precision } = CURRENCIES[currency]
        if (currencyRate === undefined) {
          throw new Error(`currency rate not found ${rate}`)
        }
        const { sellRate } = currencyRate
        const precisionAdj = Math.pow(10, precision)
        const amount = Math.round(sellRate * fix(a.amount) * precisionAdj) / precisionAdj
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
          amount: fix(a.amount) + fix(b.amount),
          currency: a.currency
        }
      } else {
        const x = calculator.convert(a)
        const y = calculator.convert(b)
        return {
          amount: fix(x.amount) + fix(y.amount),
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
          amount: fix(a.amount) - fix(b.amount),
          currency: a.currency
        }
      } else {
        const x = calculator.convert(a)
        const y = calculator.convert(b)
        return {
          amount: fix(x.amount) - fix(y.amount),
          currency: x.currency
        }
      }
    },
    multi: (a, b) => {
      return {
        amount: fix(a.amount) * b,
        currency: a.currency
      }
    },
    parse: (a, currency = base) => {
      throw new Error('unsupported')
    },
    format: (money, currency) => {
      if (currency !== undefined && money.currency !== currency) {
        money = calculator.convert(money, currency)
      }
      if (money.currency === 'USD') {
        return money.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: CURRENCIES.USD.precision, maximumFractionDigits: CURRENCIES.USD.precision })
      } else if (money.currency === 'MNT') {
        return money.amount.toLocaleString('mn-MN', { style: 'currency', currency: 'MNT', minimumFractionDigits: CURRENCIES.MNT.precision, maximumFractionDigits: CURRENCIES.MNT.precision }).replace(/\s/g, '')
      }
      throw new Error(`unsupported currency ${money.currency}`)
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
//   const res = money.sum({
//     amount: '1.321321321',
//     currency: 'MNT'
//   }, money.new(0))
//   console.log(money.format(res))
// }

// test()
