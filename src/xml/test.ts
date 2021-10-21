import { XmlDate, XmlDef, XmlNumber, XmlString } from './types'
import fs from 'fs'
import { XML } from '.'
import '../logger'

interface IGrpHdr {
  MsgId: string
  CreDtTm: Date
  TxsCd: string
  NbOfTxs: number
  CtrlSum?: number
  InitgPty: {
    Id: {
      OrgId: {
        AnyBIC: string
      }
    }
  }
  Crdtl: {
    Lang: number
    LoginID: string
    Pwds: Array<{
      PwdType: number
      Pwd: string
    }>
  }
}

interface IPmtInf {
  NbOfTxs: number
  CtrlSum?: number
  ForT: string
  Dbtr: {
    Nm: string
  }
  DbtrAcct: {
    Id: {
      IBAN: string
    }
    Ccy: string
  }
  CdtTrfTxInf: [{
    CdtrId: number
    Amt: {
      InstdAmt: number
      InstdCcy: string
    }
    Cdtr: {
      Nm: string
    }
    CdtrAcct: {
      Id: {
        IBAN: string
      }
      Ccy: string
    }
    CdtrAgt: {
      FinInstnId: {
        BICFI: string
      }
    }
    RmtInf: {
      AddtlRmtInf: string
    }
  }]
}

interface IDocument {
  Document: {
    GrpHdr: IGrpHdr
    PmtInf?: IPmtInf
  }
}

const documentDef: XmlDef<IDocument> = {
  Document: {
    GrpHdr: {
      Crdtl: {
        Lang: XmlNumber(),
        LoginID: XmlString(),
        Pwds: [{
          Pwd: XmlString(),
          PwdType: XmlNumber()
        }]
      },
      CreDtTm: XmlDate('YYYY-MM-DDTHH:mm:ss'),
      InitgPty: {
        Id: {
          OrgId: {
            AnyBIC: XmlString()
          }
        }
      }
    }
  }
}

const main = async (): Promise<void> => {
  console.log(escape('<>'))
  console.debug(Object.keys({ b: 1, a: 2 }))
  const xml = fs.readFileSync('test.xml').toString('utf-8')
  const d = XML(documentDef).parse(xml)
  console.log(JSON.stringify(d))
  const e = XML(documentDef).format(d)
  console.log(e)
}

main().catch(e => console.error(e))
