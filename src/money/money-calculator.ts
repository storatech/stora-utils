export type Currency = 'USD' | 'MNT' | 'USc' | 'CNY'

export interface StringMoney {
  amount: string
  currency: Currency
}

export interface NumberMoney {
  amount: number
  currency: Currency
}

export type Money = StringMoney | NumberMoney

export interface MoneyRange {
  minAmount: string | number
  maxAmount: string | number
  currency: Currency
}

export interface CurrencyRate {
  /** MNT_USD => 1MNT = XUSD */
  rate: number
  buyRate: number
  sellRate: number
}

interface CurrencyTransformer {
  format: (money: Money) => string
  parse: (money: string) => NumberMoney
}

interface CurrencyDefinition {
  name: string
  symbol: string
  currency: Currency
  precision: number
  transformer: CurrencyTransformer
}

const toNumber = (a: string | number): number => {
  if (typeof a === 'number') {
    return a
  } else {
    return parseFloat(a.replace(/[^\d.-]/gi, ''))
  }
}

export const CURRENCIES: Record<Currency, CurrencyDefinition> = {
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
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').replace(/-/gi, '').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.-]/gi, '')
          if (amount.match(/^-?\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculatorImpl({}, def.currency).new(amount)
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
          return `${parseFloat(money.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}₮`
        } else if (typeof money.amount === 'number') {
          return `${money.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}₮`
        }
        throw new Error('unknown amount')
      },
      parse: (money) => {
        const def = CURRENCIES.MNT
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').replace(/-/gi, '').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.-]/gi, '')
          if (amount.match(/^-?\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculatorImpl({}, def.currency).new(amount)
          }
        }
        throw new Error('parse error')
      }
    }
  },
  CNY: {
    name: 'Chinese Yuan',
    currency: 'CNY',
    symbol: '¥',
    precision: 2,
    transformer: {
      format: (money) => {
        // return toNumber(money.amount).toLocaleString('en-US', { style: 'currency', currency: 'CNY', minimumFractionDigits: CURRENCIES.CNY.precision, maximumFractionDigits: CURRENCIES.CNY.precision })

        const def = CURRENCIES.CNY
        if (typeof money.amount === 'string') {
          return `${parseFloat(money.amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${def.symbol}`
        } else if (typeof money.amount === 'number') {
          return `${money.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${def.symbol}`
        }
        throw new Error('unknown amount')
      },
      parse: (money) => {
        const def = CURRENCIES.CNY
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').replace(/-/gi, '').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.-]/gi, '')
          if (amount.match(/^-?\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculatorImpl({}, def.currency).new(amount)
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
        const symbol = money.replace(/[\d.,'\s]+/gi, ' ').replace(/-/gi, '').trim()
        if (symbol === def.symbol || symbol === def.currency) {
          const amount = money.replace(/[^\d.-]/gi, '')
          if (amount.match(/^-?\d+(.\d+)?$/gi) !== null) {
            return MoneyCalculatorImpl({}, 'USD').new(toNumber(amount) / 100)
          }
        }
        throw new Error('parse error')
      }
    }
  }
}

type MoneyCalculator = (currencyRates: Record<string, CurrencyRate>, base?: Currency) => {
  amount: (a: Money) => number
  new: (a: number | string, currency?: Currency) => NumberMoney
  convert: (a: Money, currency?: Currency) => NumberMoney
  add: (a: Money | undefined | null, b: Money | undefined | null) => NumberMoney
  sum: (...a: Array<Money | undefined | null>) => NumberMoney
  sub: (a: Money, b: Money) => NumberMoney
  multi: (a: Money, b: number) => NumberMoney
  parse: (a: string, currency?: Currency) => NumberMoney
  format: (a: Money, currency?: Currency) => string
  toStringMoney: (a: Money) => StringMoney
  toNumberMoney: (a: Money) => NumberMoney
}
const MoneyCalculatorImpl: MoneyCalculator = (currencyRates, base = 'MNT') => {
  const calculator: ReturnType<MoneyCalculator> = {
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
        return calculator.toNumberMoney(b)
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
      if (a === undefined || b === undefined || a == null || b == null) {
        return calculator.toNumberMoney(a ?? b ?? calculator.new(0))
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
      return rest.reduce<NumberMoney>((r, b) => {
        return calculator.add(r, b)
      }, calculator.toNumberMoney(c ?? calculator.new(0)))
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
      const { precision } = CURRENCIES[a.currency]
      const precisionAdj = Math.pow(10, precision)
      const amount = Math.round(b * toNumber(a.amount) * precisionAdj) / precisionAdj
      return {
        amount,
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
    },
    toStringMoney: (money) => {
      return {
        ...money,
        amount: money.amount.toString()
      }
    },
    toNumberMoney: (money) => {
      return {
        ...money,
        amount: toNumber(money.amount)
      }
    }
  }
  return calculator
}

export default MoneyCalculatorImpl
