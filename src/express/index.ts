import { NextFunction, Request, RequestHandler, Response } from 'express'
import { getLogger } from 'log4js'

export type ApiRequest<Params = Record<string, string>, Query = Record<string, string> > = Request<Params, any, any, Query>
export type ApiGet<Query = Record<string, string>> = Request<Record<string, any>, any, any, Query>
export type ApiDelete<Query = Record<string, string>> = Request<Record<string, string>, any, any, Query>
export type ApiPost<ReqBody = any> = Request<Record<string, string>, any, ReqBody>
export type ApiPut<ReqBody = any> = Request<Record<string, string>, any, ReqBody>
export type ApiResponse<Data = any, Context extends Record<string, any> = Record<string, any>> = Response<ApiBody<Data>, Context>
export type ApiNextFunction = NextFunction
export type ApiHandler<Context extends Record<string, any> = Record<string, any>> = RequestHandler<Record<string, string>, any, any, Record<string, string>, Context>

export interface ApiQuery {
  limit?: string
  offset?: string
}

export type ApiBody<T = any> = T | ApiError

export interface ApiError {
  errorCode: ApiErrorCode
  error: String
  cause?: any
}

export enum ApiErrorCode {
  TOKEN_EXPIRED = 993,
  VERIFY_REQUIRED = 994,
  CONFLICT = 995,
  BAD_REQUEST = 996,
  UNAUTHORIZED = 997,
  FORBIDDEN = 998,
  INTERNAL_ERROR = 999
}

export enum HttpStatus {
  OK = 200,
  FOUND = 302,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  CONFLICT = 409,
  NOT_FOUND = 404,
  INTERNAL_ERROR = 500
}

const logger = getLogger('http')

export class ApiException extends Error {
  status: HttpStatus
  code: ApiErrorCode
  data?: any

  constructor (status: HttpStatus, code: ApiErrorCode, message: string, data?: any) {
    super(message)
    Object.setPrototypeOf(this, ApiException.prototype)
    this.constructor = ApiException
    this.message = message
    this.status = status
    this.code = code
    this.data = data
  }
}

export interface Pagination {
  limit: number
  offset: number
}

export interface PaginationResult extends Pagination {
  total: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: PaginationResult
}

const getErrorHtml = async (error: Error, template: string = 'error'): Promise<string> => {
  return error.message
}

export const expressErrorHandler = async (e: ApiException | SyntaxError | Error, req: ApiRequest, res: ApiResponse<ApiError | string>, next: ApiNextFunction): Promise<void> => {
  const type = req.headers.accept !== undefined ? req.accepts(['html', 'json']) : undefined
  if (e instanceof ApiException) {
    res.status(e.status)
    if (type === 'html') {
      res.send(await getErrorHtml(e))
    } else {
      res.json({
        errorCode: e.code,
        error: e.message,
        cause: e.data
      })
    }
  } else if (e instanceof SyntaxError) {
    res.status(HttpStatus.BAD_REQUEST)
    if (type === 'html') {
      res.send(await getErrorHtml(e))
    } else {
      res.json({
        errorCode: ApiErrorCode.BAD_REQUEST,
        error: e.message
      })
    }
  } else {
    logger.error('unknown error', e)
    res.status(HttpStatus.INTERNAL_ERROR)
    if (type === 'html') {
      res.send(await getErrorHtml(e))
    } else {
      res.json({
        errorCode: ApiErrorCode.INTERNAL_ERROR,
        error: 'unknown error'
      })
    }
  }
}

export const expressNotFoundHandler = async (req: ApiRequest, res: ApiResponse, next: ApiNextFunction): Promise<void> => {
  const type = req.headers.accept !== undefined ? req.accepts(['html', 'json']) : undefined
  res.status(HttpStatus.NOT_FOUND)
  if (type === 'html') {
    res.send(await getErrorHtml(new Error('Not found')))
  } else {
    res.json({
      errorCode: ApiErrorCode.BAD_REQUEST,
      error: 'not found'
    })
  }
}

interface ResponseHelpers {
  paginatedSuccess: (data: any, pagination: PaginationResult) => void
  success: (data: any) => void
  error: (error: ApiError) => void
}

// Adds res.success, res.paginatedSuccess and res.error (restored from the published 2.8.0)
export const expressResponseHelper = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  const helpers = res as Response & ResponseHelpers
  helpers.paginatedSuccess = (data, pagination) => {
    res.setHeader('Content-Type', 'application/json')
    res.send({
      status: 'success',
      data,
      pagination
    })
  }
  helpers.success = (data) => {
    res.setHeader('Content-Type', 'application/json')
    res.send({
      status: 'success',
      data
    })
  }
  helpers.error = (error) => {
    res.setHeader('Content-Type', 'application/json')
    res.send({
      status: 'failed',
      message: error.error,
      code: error.errorCode
    })
  }
  if (next !== null) {
    next()
  }
}
