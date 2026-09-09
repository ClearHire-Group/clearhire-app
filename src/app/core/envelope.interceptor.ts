import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * O backend real embrulha toda resposta em `{ success, data }` (`pkg/response` do clearhire-server)
 * — erros já saem com status não-2xx, então HttpClient já os expõe como HttpErrorResponse
 * corretamente sem ajuda nenhuma; só o caminho de sucesso precisa ser desembrulhado antes de chegar
 * no HttpApiService, que espera `data` diretamente (mesmo formato que o MockApiService já devolve).
 */
export const envelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) => {
      if (
        event instanceof HttpResponse &&
        event.body &&
        typeof event.body === 'object' &&
        'success' in event.body &&
        'data' in event.body
      ) {
        return event.clone({ body: (event.body as { data: unknown }).data });
      }
      return event;
    }),
  );
