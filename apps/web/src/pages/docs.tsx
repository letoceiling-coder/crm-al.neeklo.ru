import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BASE =
  typeof window !== 'undefined' ? window.location.origin : 'https://crm-al.neeklo.ru';

export function DocsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Документация API</h1>
        <p className="text-muted-foreground">
          Запросы по API-ключу: баланс, необязательный параметр model, профили auto / aura / neeklo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Авторизация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`Authorization: Bearer agw_ваш_ключ`}
          </pre>
          <p className="text-muted-foreground">
            Ключ создаётся в разделе <strong>API Ключи</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Порядок обработки запроса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>Проверка API-ключа (статус, IP; список доменов хранится в настройках ключа для учёта).</li>
            <li>
              <strong>Проверка баланса</strong> — пересчёт расхода по логам; при нулевом остатке ответ{' '}
              <strong>402</strong>.
            </li>
            <li>
              Выбор цепочки и тарифа: параметр <code>model</code> (см. ниже) или профиль <code>auto</code>{' '}
              по умолчанию.
            </li>
            <li>Вызов OpenRouter с fallback по цепочке выбранного профиля.</li>
            <li>Списание с баланса по тарифу выбранного профиля (₽ за 1M токенов).</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Параметр model (необязательный)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            В теле запроса (<code>POST /api/v1/chat/completions</code>, агенты) поле{' '}
            <code>model</code> можно <strong>не передавать</strong> — тогда используется профиль{' '}
            <code>auto</code>.
          </p>
          <p>Доступные значения (профили владельца ключа):</p>
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">model</th>
                <th className="text-left p-2 font-medium">Тариф (пример)</th>
                <th className="text-left p-2 font-medium">Назначение</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border">
                <td className="p-2">
                  <code>auto</code> или не указано
                </td>
                <td className="p-2">2000 ₽ / 1M</td>
                <td className="p-2">Бесплатные языковые модели + 2 дешёвых платных</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">
                  <code>aura</code>
                </td>
                <td className="p-2">3000 ₽ / 1M</td>
                <td className="p-2">Документы, OCR, длинный контекст</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">
                  <code>neeklo</code>
                </td>
                <td className="p-2">8000 ₽ / 1M</td>
                <td className="p-2">Платные модели среднего уровня</td>
              </tr>
            </tbody>
          </table>
          <p className="text-muted-foreground">
            Профиль в запросе <strong>не обязан совпадать</strong> с настройкой ключа в панели: любой ключ
            может вызвать <code>auto</code>, <code>aura</code> или <code>neeklo</code> — применяются цепочка
            и цена этого профиля.
          </p>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`POST ${BASE}/api/v1/chat/completions
Authorization: Bearer agw_...

{ "messages": [...] }
{ "model": "aura", "messages": [...] }
{ "model": "neeklo", "messages": [...] }`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список моделей для ключа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`GET ${BASE}/api/v1/models
Authorization: Bearer agw_...`}
          </pre>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "defaultModel": "auto",
  "models": ["auto", "aura", "neeklo"],
  "data": [
    { "id": "auto", "type": "profile", "slug": "auto", "pricePerMillionRub": 2000, "modelChain": [...] },
    { "id": "aura", "type": "profile", "slug": "aura", "pricePerMillionRub": 3000, ... },
    { "id": "neeklo", "type": "profile", "slug": "neeklo", "pricePerMillionRub": 8000, ... }
  ]
}`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Баланс и пополнения (₽)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            <strong>Начислено</strong> (<code>balanceRub</code>) — сумма всех пополнений.{' '}
            <strong>Потрачено</strong> (<code>spentRub</code>) — расход по API.{' '}
            <strong>Остаток</strong> = начислено − потрачено. Кнопка «Сохранить» в панели не меняет
            баланс — только пополнение.
          </p>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`GET ${BASE}/api/v1/balance
Authorization: Bearer agw_...`}
          </pre>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "balanceRub": 1000,
  "spentRub": 0.07,
  "remainingRub": 999.93,
  "isExhausted": false,
  "currency": "RUB"
}`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Статистика пополнений (платежи)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Учитываются только <strong>начисления на баланс</strong> (пополнения в панели и начальный
            баланс при создании ключа). Расход по токенам — в разделе{' '}
            <a href="#usage-stats" className="text-primary underline">
              Статистика использования
            </a>
            , не в платежах.
          </p>

          <h3 className="font-medium text-foreground">Через API-ключ (интеграции)</h3>
          <p className="text-muted-foreground">
            Доступны данные <strong>только по этому ключу</strong> (<code>agw_...</code>).
          </p>

          <p className="font-medium">Сводка пополнений</p>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`GET ${BASE}/api/v1/balance/top-ups/stats?from=2026-06-01&to=2026-06-30
Authorization: Bearer agw_...`}
          </pre>
          <p className="text-muted-foreground">Параметры (все необязательные):</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              <code>from</code>, <code>to</code> — период (ISO-дата, например <code>2026-06-01</code>)
            </li>
          </ul>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "totalTopUpRub": 1000,
  "topUpCount": 1,
  "byApiKey": [
    {
      "apiKeyId": "clx...",
      "name": "parser-docs",
      "keyPrefix": "agw_c0f8cbd0",
      "totalRub": 1000,
      "count": 1
    }
  ]
}`}
          </pre>

          <p className="font-medium">История пополнений (постранично)</p>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`GET ${BASE}/api/v1/balance/top-ups?page=1&limit=20&from=2026-06-01
Authorization: Bearer agw_...`}
          </pre>
          <p className="text-muted-foreground">Параметры:</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>
              <code>page</code> — страница (по умолчанию 1)
            </li>
            <li>
              <code>limit</code> — записей на странице (по умолчанию 20, макс. 100)
            </li>
            <li>
              <code>from</code>, <code>to</code> — фильтр по дате
            </li>
          </ul>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "data": [
    {
      "id": "clx...",
      "apiKeyId": "clx...",
      "amountRub": 1000,
      "balanceBefore": 0,
      "balanceAfter": 1000,
      "type": "INITIAL",
      "comment": "Начальный баланс при создании ключа",
      "createdAt": "2026-06-02T10:00:00.000Z",
      "apiKey": { "id": "...", "name": "parser-docs", "keyPrefix": "agw_c0f8cbd0" }
    },
    {
      "id": "clx...",
      "amountRub": 500,
      "balanceBefore": 1000,
      "balanceAfter": 1500,
      "type": "TOP_UP",
      "comment": "Пополнение от клиента",
      "createdAt": "2026-06-15T12:00:00.000Z"
    }
  ],
  "meta": { "total": 2, "page": 1, "limit": 20, "totalPages": 1 }
}`}
          </pre>
          <p className="text-muted-foreground">
            Типы: <code>INITIAL</code> — при создании ключа, <code>TOP_UP</code> — пополнение в панели.
          </p>

          <h3 className="font-medium text-foreground">Через панель (JWT, все ключи пользователя)</h3>
          <p className="text-muted-foreground">
            После входа в CRM. Подходит для биллинга и отчётов по всем ключам аккаунта.
          </p>
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Метод</th>
                <th className="text-left p-2 font-medium">Назначение</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border">
                <td className="p-2 font-mono text-xs">GET /api/api-keys/top-ups/stats</td>
                <td className="p-2">Сводка пополнений по всем ключам (фильтры: from, to, apiKeyId)</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2 font-mono text-xs">GET /api/api-keys/top-ups</td>
                <td className="p-2">Список пополнений (page, limit, from, to, apiKeyId)</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2 font-mono text-xs">GET /api/api-keys/:id/top-ups</td>
                <td className="p-2">История по одному ключу</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2 font-mono text-xs">POST /api/api-keys/:id/top-up</td>
                <td className="p-2">Пополнить: {`{ "amountRub": 500, "comment": "..." }`}</td>
              </tr>
            </tbody>
          </table>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`GET ${BASE}/api/api-keys/top-ups/stats?apiKeyId=KEY_ID&from=2026-06-01
Authorization: Bearer <JWT из login>`}
          </pre>

          <h3 className="font-medium text-foreground">Пример (curl)</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`curl "${BASE}/api/v1/balance/top-ups/stats" \\
  -H "Authorization: Bearer agw_ваш_ключ"

curl "${BASE}/api/v1/balance/top-ups?page=1&limit=10" \\
  -H "Authorization: Bearer agw_ваш_ключ"`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chat Completions и агенты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`POST ${BASE}/api/v1/chat/completions
POST ${BASE}/api/v1/agents/:id/chat
Content-Type: application/json
Authorization: Bearer agw_...`}
          </pre>
          <p>
            Формат OpenAI-compatible. Поле <code>model</code> — необязательно (по умолчанию{' '}
            <code>auto</code>). Для агента системный промпт агента добавляется автоматически.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Передача файлов (PDF, Word, Excel, ZIP, фото)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Отдельной загрузки <code>multipart/form-data</code> нет: всё передаётся в одном JSON-запросе
            в поле <code>messages</code>. Шлюз проксирует тело в OpenRouter без изменения структуры
            вложений.
          </p>

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <strong>Рекомендуемый профиль для документов и фото:</strong>{' '}
            <code>model: &quot;aura&quot;</code> (OCR, длинный контекст).
          </div>

          <h3 className="font-medium text-foreground">Поддерживаемые типы и способ передачи</h3>
          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Тип</th>
                <th className="text-left p-2 font-medium">Как передавать в API</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border">
                <td className="p-2">Фото (JPG, PNG, WebP)</td>
                <td className="p-2">
                  Блок <code>image_url</code> в <code>content</code> (URL или base64). См. пример ниже.
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">PDF</td>
                <td className="p-2">
                  Предпочтительно: извлечь текст на клиенте и отправить как <code>text</code>. Либо
                  страницы как изображения через <code>image_url</code> (сканы).
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">Word (.docx)</td>
                <td className="p-2">
                  На клиенте конвертировать в текст (например mammoth/docx-parser), затем{' '}
                  <code>content</code> типа <code>text</code> с пометкой имени файла.
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">Excel (.xlsx)</td>
                <td className="p-2">
                  На клиенте — CSV/текст таблицы или JSON фрагмент в <code>text</code> (по листам при
                  большом объёме).
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">ZIP</td>
                <td className="p-2">
                  Распаковать на клиенте; каждый файл обработать по правилам выше. Не отправлять весь
                  архив одним base64, если он больше лимита.
                </td>
              </tr>
            </tbody>
          </table>

          <h3 className="font-medium text-foreground">Два способа вложений</h3>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Публичный HTTPS URL</strong> (лучше для больших файлов)
              — файл лежит на вашем S3/CDN/сервере, в запросе только ссылка.
            </li>
            <li>
              <strong className="text-foreground">Base64 в JSON</strong> — для небольших фото/PDF-страниц:
              <code>data:image/png;base64,...</code> в <code>image_url.url</code>.
            </li>
          </ol>

          <h3 className="font-medium text-foreground">Пример: фото + вопрос (агент или chat)</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`POST ${BASE}/api/v1/agents/AGENT_ID/chat

{
  "model": "aura",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Опиши содержимое вложения" },
        {
          "type": "image_url",
          "image_url": {
            "url": "https://storage.example.com/scan.png"
          }
        }
      ]
    }
  ]
}`}
          </pre>

          <h3 className="font-medium text-foreground">Пример: PDF / Word / Excel как текст</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "model": "aura",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Файл: contract.docx\\n\\n<извлечённый текст документа>"
        }
      ]
    }
  ]
}`}
          </pre>

          <h3 className="font-medium text-foreground">Пример: несколько файлов (метаданные + части)</h3>
          <p className="text-muted-foreground">
            Для пакета документов удобно передавать массив описаний в первом текстовом блоке, затем
            содержимое по частям или отдельными запросами:
          </p>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "model": "aura",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "{\\"attachments\\":[{\\"name\\":\\"a.pdf\\",\\"kind\\":\\"pdf\\"},{\\"name\\":\\"b.xlsx\\",\\"kind\\":\\"xlsx\\"}]}"
        },
        { "type": "text", "text": "--- a.pdf ---\\n<текст части 1>" },
        { "type": "text", "text": "--- b.xlsx ---\\n<текст листа 1>" }
      ]
    }
  ]
}`}
          </pre>

          <h3 className="font-medium text-foreground">Большие объёмы данных</h3>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>
              Лимит тела запроса на API по умолчанию — <strong>50 MB</strong> (настройка{' '}
              <code>BODY_LIMIT</code> на сервере). Base64 увеличивает размер ~ на 33%.
            </li>
            <li>
              Практический ориентир для base64 в одном запросе: файлы до <strong>~10–15 MB</strong>{' '}
              исходника; больше — только по HTTPS URL или разбиение.
            </li>
            <li>
              Длинные PDF/Excel: разбивайте на части (страницы, листы) и несколько вызовов API, либо
              сначала сжимайте/суммаризируйте на клиенте.
            </li>
            <li>
              ZIP с множеством файлов: обрабатывайте на клиенте по одному файлу или пачками, не вкладывайте
              весь архив в JSON.
            </li>
            <li>
              Таймаут запроса к модели — до <strong>120 с</strong>; очень большие промпты могут давать
              ошибку по времени или лимиту контекста модели.
            </li>
          </ul>

          <h3 className="font-medium text-foreground">Что не поддерживается напрямую</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <code>multipart/form-data</code> и отдельный endpoint <code>POST /files</code>
            </li>
            <li>
              Бинарный ZIP/PDF «как есть» без извлечения текста или конвертации в image/text (модель не
              получит файл, если он не в <code>messages</code> в поддерживаемом виде)
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ошибки, валидация и сбои</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Ответы об ошибках — JSON с полями <code>statusCode</code>, <code>code</code>,{' '}
            <code>message</code>. Поле <code>message</code> можно показывать пользователю как есть.
          </p>

          <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">HTTP</th>
                <th className="text-left p-2 font-medium">code</th>
                <th className="text-left p-2 font-medium">Сообщение для пользователя</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-t border-border">
                <td className="p-2">402</td>
                <td className="p-2">
                  <code>INSUFFICIENT_BALANCE</code>
                </td>
                <td className="p-2">
                  Недостаточно средств на балансе API-ключа. Пополните баланс в разделе «API Ключи».
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">401</td>
                <td className="p-2">
                  <code>MISSING_API_KEY</code>
                </td>
                <td className="p-2">Укажите API-ключ: Authorization: Bearer agw_...</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">401</td>
                <td className="p-2">
                  <code>INVALID_API_KEY</code>
                </td>
                <td className="p-2">API-ключ недействителен, отключён или заблокирован.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">403</td>
                <td className="p-2">
                  <code>IP_NOT_ALLOWED</code>
                </td>
                <td className="p-2">Запрос с этого IP не разрешён для ключа.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">400</td>
                <td className="p-2">—</td>
                <td className="p-2">
                  Неверный запрос: неверный <code>model</code>, пустой <code>messages</code>, слишком
                  большое тело (см. ниже).
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">404</td>
                <td className="p-2">
                  <code>AGENT_NOT_FOUND</code>
                </td>
                <td className="p-2">Агент не найден — проверьте id в GET /api/v1/agents.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">404</td>
                <td className="p-2">
                  <code>AGENT_UNAVAILABLE</code>
                </td>
                <td className="p-2">Агент отключён администратором.</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">502</td>
                <td className="p-2">
                  <code>MODELS_UNAVAILABLE</code>
                </td>
                <td className="p-2">
                  Все модели в цепочке недоступны. Повторите позже или смените профиль (auto / aura /
                  neeklo).
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">413</td>
                <td className="p-2">—</td>
                <td className="p-2">
                  Тело запроса слишком большое. Уменьшите файлы или используйте URL вместо base64.
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-2">429</td>
                <td className="p-2">—</td>
                <td className="p-2">Слишком много запросов. Подождите и повторите.</td>
              </tr>
            </tbody>
          </table>

          <h3 className="font-medium text-foreground">402 — недостаточно средств</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`HTTP/1.1 402 Payment Required

{
  "statusCode": 402,
  "error": "Payment Required",
  "code": "INSUFFICIENT_BALANCE",
  "message": "Недостаточно средств на балансе API-ключа. Пополните баланс в разделе «API Ключи».",
  "balanceRub": 1000,
  "spentRub": 1000,
  "remainingRub": 0,
  "currency": "RUB"
}`}
          </pre>
          <p className="text-muted-foreground">
            Проверьте остаток заранее: <code>GET /api/v1/balance</code>. Поле{' '}
            <code>remainingRub</code> — сколько ещё доступно.
          </p>

          <h3 className="font-medium text-foreground">401 — проблема с ключом</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "statusCode": 401,
  "error": "Unauthorized",
  "code": "INVALID_API_KEY",
  "message": "API-ключ недействителен, отключён или заблокирован. Создайте новый ключ в панели."
}`}
          </pre>

          <h3 className="font-medium text-foreground">400 — валидация и модель</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "MODEL_NOT_AVAILABLE",
  "message": "Модель «unknown» недоступна. Укажите auto, aura или neeklo — см. GET /api/v1/models"
}`}
          </pre>
          <p className="text-muted-foreground">
            Коды: <code>PROFILE_NOT_FOUND</code>, <code>PROFILE_EMPTY</code>,{' '}
            <code>MODEL_NOT_AVAILABLE</code>; при неверном JSON — стандартный ответ Nest без{' '}
            <code>code</code>.
          </p>

          <h3 className="font-medium text-foreground">502 — сбой моделей</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`{
  "statusCode": 502,
  "error": "Bad Gateway",
  "code": "MODELS_UNAVAILABLE",
  "message": "Не удалось получить ответ ни от одной модели. Повторите запрос позже или укажите другой профиль (model).",
  "detail": "..."
}`}
          </pre>

          <h3 className="font-medium text-foreground">Рекомендация для клиента</h3>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`if (response.status === 402) {
  showError(response.data.message); // «Пополните баланс…»
} else if (response.data?.message) {
  showError(response.data.message);
} else {
  showError('Произошла ошибка. Попробуйте позже.');
}`}
          </pre>
        </CardContent>
      </Card>

      <Card id="usage-stats">
        <CardHeader>
          <CardTitle>Статистика использования (расход по API)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Токены, запросы и стоимость вызовов моделей. Для <strong>пополнений баланса</strong> см.
            раздел «Статистика пополнений» выше.
          </p>
          <pre className="rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto font-mono text-xs">
            {`GET ${BASE}/api/v1/usage
Authorization: Bearer agw_...

GET ${BASE}/api/v1/usage/logs?page=1&limit=20
GET ${BASE}/api/v1/usage/daily
GET ${BASE}/api/v1/usage/models`}
          </pre>
          <p className="text-muted-foreground">
            В панели аналогичные данные: раздел <strong>Аналитика</strong> (JWT).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
