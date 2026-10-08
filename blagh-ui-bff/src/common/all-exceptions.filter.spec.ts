import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(status: jest.Mock, json: jest.Mock, method = 'GET', url = '/test') {
  const res = { status, json };
  status.mockReturnValue(res);
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method, url }),
    }),
  } as any;
}

describe('AllExceptionsFilter (widget-bff)', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('handles HttpException with object response', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = makeHost(statusFn, jsonFn);
    const exc = new HttpException({ message: 'Not found', statusCode: 404 }, 404);
    filter.catch(exc, host);
    expect(statusFn).toHaveBeenCalledWith(404);
    expect(jsonFn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Not found' }));
  });

  it('handles HttpException with string response', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = makeHost(statusFn, jsonFn);
    const exc = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(exc, host);
    expect(statusFn).toHaveBeenCalledWith(403);
    expect(jsonFn).toHaveBeenCalledWith({ message: 'Forbidden' });
  });

  it('handles non-HttpException with 500', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = makeHost(statusFn, jsonFn, 'POST', '/api/reports');
    filter.catch(new Error('Something went wrong'), host);
    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('handles non-Error non-HttpException (e.g. string throw)', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = makeHost(statusFn, jsonFn);
    filter.catch('string error', host);
    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});
