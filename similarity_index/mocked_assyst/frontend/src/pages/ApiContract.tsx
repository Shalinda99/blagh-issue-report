import { BookOpen, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';

const WIKI_URL =
  'https://wiki.axiossystems.com/assyst11-5Wiki/index.php/Integrations:assystREST';

function Verified() {
  return (
    <Badge className="bg-green-50 text-green-700 border-green-200">
      <CheckCircle2 className="w-3 h-3 mr-1" />Verified
    </Badge>
  );
}

function Provisional() {
  return (
    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
      <AlertTriangle className="w-3 h-3 mr-1" />Provisional
    </Badge>
  );
}

function Section({
  title,
  status,
  children,
}: {
  title: string;
  status?: 'verified' | 'provisional';
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {status === 'verified' && <Verified />}
        {status === 'provisional' && <Provisional />}
      </div>
      <div className="text-sm text-slate-600 space-y-3">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {head.map(h => (
              <th key={h} className="px-3 py-2 font-semibold border-b border-slate-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-slate-600">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const mono = 'font-mono text-[11px] bg-slate-100 text-slate-800 rounded px-1 py-0.5';

export function ApiContract() {
  return (
    <div>
      <Header
        title="API Contract"
        subtitle="Essential details of the IFS / Axios assystREST API (v2)"
      />
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-start gap-3 text-sm text-slate-700">
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5 text-brand-500" />
          <div className="space-y-1">
            <p>
              This page summarizes the public <strong>assystREST API v2</strong> contract
              (assyst 11.5) that this environment emulates. Items are marked{' '}
              <span className="text-green-700 font-medium">Verified</span> when confirmed by
              the official documentation and{' '}
              <span className="text-amber-700 font-medium">Provisional</span> when inferred
              from naming conventions / RAML.
            </p>
            <a
              href={WIKI_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium"
            >
              Official source: wiki.axiossystems.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <Section title="1. Base URL & Versioning" status="verified">
          <Table
            head={['Item', 'Value']}
            rows={[
              ['API Version', <span className={mono}>v2</span>],
              ['Base Path', <span className={mono}>/assystREST/v2</span>],
              ['Protocols', 'HTTP, HTTPS'],
              ['Content Types', 'application/json, application/xml'],
            ]}
          />
          <Code>{`http://<server>:<port>/assystREST/v2/<resource>          # collection
http://<server>:<port>/assystREST/v2/<resource>/<id>     # single item`}</Code>
          <p>Resource names are always plural.</p>
        </Section>

        <Section title="2. Authentication" status="verified">
          <p>
            Supported mechanisms (configured at install): <strong>Basic Authentication</strong>{' '}
            (LDAP / DB security domain), SAML, X.509, Azure AD. This environment uses Basic Auth.
          </p>
          <Code>{`Authorization: Basic <base64(username:password)>`}</Code>
          <Table
            head={['Feature', 'Detail']}
            rows={[
              [
                'Stateful sessions',
                <>
                  Header <span className={mono}>X-assyst-Rest-UseSession: true</span> or query{' '}
                  <span className={mono}>rest.useSession=true</span> (cookie{' '}
                  <span className={mono}>JSESSIONID</span>)
                </>,
              ],
              [
                'User type',
                <>
                  <span className={mono}>rest.userType</span> = contact | assyst
                </>,
              ],
              [
                'Impersonation',
                <span className={mono}>onBehalfOfUser=&lt;shortcode&gt;</span>,
              ],
              [
                'Disconnect',
                <span className={mono}>DELETE /assystREST/v2/application/disconnect</span>,
              ],
              ['Auth errors', '401 Unauthorized · 403 Forbidden'],
            ]}
          />
        </Section>

        <Section title="3. HTTP Verbs & Request Format" status="verified">
          <Table
            head={['Verb', 'Usage']}
            rows={[
              ['GET', 'Retrieve a resource or list'],
              ['POST', 'Create OR update a resource (updates are partial)'],
              ['DELETE', 'Remove a resource'],
            ]}
          />
          <p>
            <strong>PUT is not supported</strong> — returns <span className={mono}>405 Method Not Allowed</span>.
          </p>
          <Table
            head={['Aspect', 'Format']}
            rows={[
              ['Content negotiation', 'Accept: application/json | application/xml (or .json / .xml suffix)'],
              ['Date format', <span className={mono}>2014-09-22T00:00:00Z</span>],
              ['Date range', <span className={mono}>2014-09-22T00:00:00Z,2014-09-22T20:00:00Z</span>],
              ['Booleans', 'Literal true / false'],
            ]}
          />
        </Section>

        <Section title="4. Searching & Filtering" status="verified">
          <Code>{`GET /assystREST/v2/resource?criteria[options]=value_1,...value_N`}</Code>
          <Table
            head={['Option', 'Behavior']}
            rows={[
              ['(none)', 'Exact match, include results'],
              [<span className={mono}>[exclude]</span>, 'Exclude results matching values'],
              [<span className={mono}>[like]</span>, 'Starts-with match (string fields)'],
              [<span className={mono}>%25</span>, 'Wildcard substring search (URL-encoded %)'],
            ]}
          />
          <p>Multi-value = comma-separated. Literal commas encoded as <span className={mono}>%2C</span>.</p>
          <Code>{`GET /assystREST/v2/products?shortCode[like]=Test,Demo
GET /assystREST/v2/items?shortCode[like]=%25service
GET /assystREST/v2/events?eventType=incident&eventStatus=open`}</Code>
        </Section>

        <Section title="5. Field Expansion & Filtering" status="verified">
          <p>
            By default only <strong>simple attributes</strong> are returned (no nested objects).
            Use the <span className={mono}>fields</span> parameter to expand/filter.
          </p>
          <Code>{`GET /assystREST/v2/products/45?fields=productClass.genericClass,defaultSla
GET /assystREST/v2/products/45?fields=productClass[name,shortCode]`}</Code>
          <p>
            Always returned: <span className={mono}>id</span>, <span className={mono}>shortCode</span>,{' '}
            <span className={mono}>name</span>, <span className={mono}>version</span>. Empty{' '}
            <span className={mono}>[]</span> = none; <span className={mono}>*</span> = all simple attributes.
          </p>
        </Section>

        <Section title="6. Pagination" status="provisional">
          <Table
            head={['Parameter', 'Meaning', 'Default']}
            rows={[
              [<span className={mono}>startRow</span>, 'Zero-based row offset', '0'],
              [<span className={mono}>numberOfRows</span>, 'Max rows returned', '25 (max 100)'],
            ]}
          />
          <p>
            Row limits are configurable globally and per-table. Exact default values are not
            published; the parameters above follow RAML conventions.
          </p>
        </Section>

        <Section title="7. Optimistic Locking" status="verified">
          <p>
            The <span className={mono}>version</span> field is always present. Include it in update
            requests to prevent lost updates — a mismatch returns{' '}
            <span className={mono}>409 Conflict</span>. Omitting it skips the check.
          </p>
        </Section>

        <Section title="8. Event Resource (Incidents)" status="verified">
          <Table
            head={['Operation', 'Method', 'Path']}
            rows={[
              ['List events', 'GET', <span className={mono}>/assystREST/v2/events</span>],
              ['Get event by ID', 'GET', <span className={mono}>/assystREST/v2/events/{'{id}'}</span>],
              ['Create event', 'POST', <span className={mono}>/assystREST/v2/events</span>],
              ['Update event', 'POST', <span className={mono}>/assystREST/v2/events/{'{id}'}</span>],
              ['Delete event', 'DELETE', <span className={mono}>/assystREST/v2/events/{'{id}'}</span>],
              ['List event actions', 'GET', <span className={mono}>/assystREST/v2/events/{'{id}'}/actions</span>],
              ['Get event definition', 'GET', <span className={mono}>/assystREST/v2/events/definition</span>],
            ]}
          />
          <p className="pt-1 font-medium text-slate-700">Key event fields</p>
          <Table
            head={['Field', 'Type', 'Description']}
            rows={[
              [<span className={mono}>id</span>, 'integer', 'Unique numeric event ID (immutable)'],
              [<span className={mono}>eventRef</span>, 'string', 'Human-readable reference, e.g. INC0010001'],
              [<span className={mono}>version</span>, 'integer', 'Optimistic lock version'],
              [<span className={mono}>eventType</span>, 'enum', 'INCIDENT, PROBLEM, CHANGE, SERVICE_REQUEST, ORDER, TASK, DECISION'],
              [<span className={mono}>eventStatus</span>, 'enum', 'OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED, PENDING'],
              [<span className={mono}>priorityCode</span>, 'string', 'P1 / P2 / P3 / P4'],
              [<span className={mono}>shortDescription</span>, 'string', 'Brief summary / title'],
              [<span className={mono}>remarks</span>, 'string', 'Detailed description'],
              [<span className={mono}>creationDate</span>, 'ISO 8601', 'When event was logged'],
              [<span className={mono}>lastModifiedDate</span>, 'ISO 8601', 'Last update timestamp'],
              [<span className={mono}>resolvedDate</span>, 'ISO 8601', 'When resolved (null if open)'],
              [<span className={mono}>affectedUser</span>, 'UserDto', 'Nested — expand via fields'],
              [<span className={mono}>assignedGroup</span>, 'GroupDto', 'Nested — expand via fields'],
              [<span className={mono}>service</span>, 'ServiceDto', 'Nested — expand via fields'],
              [<span className={mono}>category</span>, 'CategoryDto', 'Nested — expand via fields'],
            ]}
          />
        </Section>

        <Section title="9. Response Format" status="verified">
          <p>Collections are returned as <strong>bare JSON arrays</strong> (no envelope). Null fields and empty arrays are omitted.</p>
          <Code>{`[
  { "id": 1234, "shortCode": "My Product", "name": "My Product", "version": 25 },
  { "id": 5678, "shortCode": "Other Product", "name": "Other Product", "version": 40 }
]`}</Code>
          <p className="font-medium text-slate-700">Error response</p>
          <Code>{`{
  "type": "MethodNotAllowedException",
  "message": "The specified HTTP method is not allowed for the specified resource.",
  "diagnostic": "No resource method found for PUT, return 405 with Allow header"
}`}</Code>
          <Table
            head={['Code', 'Meaning']}
            rows={[
              ['200 / 201 / 204', 'OK / Created / No Content'],
              ['400', 'Bad Request or validation failure'],
              ['401 / 403', 'Unauthorized / Forbidden'],
              ['405', 'Method Not Allowed (e.g. PUT)'],
              ['409', 'Conflict (duplicate ID / stale version)'],
              ['410', 'Gone'],
              ['500', 'Internal Server Error'],
            ]}
          />
        </Section>

        <Section title="10. Discoverability & Reference Data">
          <p>assystREST exposes RAML descriptions:</p>
          <Code>{`GET /assystREST/v2/raml                 # Full API overview
GET /assystREST/v2/<resource>/raml      # Resource-specific RAML`}</Code>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Reference data endpoints</span>
            <Provisional />
          </div>
          <Table
            head={['Resource', 'Path']}
            rows={[
              ['assyst users', <span className={mono}>/assystREST/v2/assystUsers</span>],
              ['Contact users', <span className={mono}>/assystREST/v2/contactUsers</span>],
              ['Support groups', <span className={mono}>/assystREST/v2/supportGroups</span>],
              ['Services', <span className={mono}>/assystREST/v2/services</span>],
              ['Categories', <span className={mono}>/assystREST/v2/categories</span>],
              ['Priority codes', <span className={mono}>/assystREST/v2/priorityCodes</span>],
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
