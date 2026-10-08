import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

function makeContext(method = 'GET', url = '/test') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url }),
    }),
  } as any;
}

function makeHandler(value: unknown = {}) {
  return { handle: () => of(value) } as any;
}

describe('LoggingInterceptor (widget-bff)', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('returns an Observable that emits the handler value', (done) => {
    const obs = interceptor.intercept(makeContext(), makeHandler({ ok: true }));
    obs.subscribe({
      next: (val) => {
        expect(val).toEqual({ ok: true });
      },
      complete: done,
    });
  });

  it('works for different HTTP methods and URLs', (done) => {
    const obs = interceptor.intercept(
      makeContext('POST', '/api/reports'),
      makeHandler({}),
    );
    obs.subscribe({ complete: done });
  });

  it('logs without error when value is null', (done) => {
    const obs = interceptor.intercept(makeContext(), makeHandler(null));
    obs.subscribe({ complete: done });
  });
});
