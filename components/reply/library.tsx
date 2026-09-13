'use client';
import { useState } from 'react';
import { ArrowUpRight, BookOpen, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NativeSelect } from '@/components/ui/native-select';
import {
  canApprove,
  canEdit,
  digest,
  normalizeReferences,
  referenceProblem,
  short,
  utf8,
} from '@/lib/reply/core';
import { read } from '@/lib/reply/chain';
import type {
  AnswerCard,
  Bundle,
  Operation,
  Reference,
  Role,
  Workspace,
} from '@/lib/reply/types';
import {
  Attribution,
  CopyButton,
  DownloadButton,
  Empty,
  Field,
  Notice,
  Timestamp,
} from './common';

export function Library({
  workspace,
  bundle,
  role,
  cards,
  busy,
  stage,
  reuse,
  openReview,
  loadMore,
  more,
  onError,
}: {
  workspace: Workspace | null;
  bundle: Bundle | null;
  role: Role;
  cards: AnswerCard[];
  busy: boolean;
  stage: (op: Operation) => void;
  reuse: (question: string, draft: string) => void;
  openReview: (id: string) => void;
  loadMore: () => void;
  more: boolean;
  onError: (e: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [documents, setDocuments] = useState<Reference[]>([]);
  const [editVersion, setEditVersion] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState('');
  const [historic, setHistoric] = useState<Bundle | null>(null);
  const [reading, setReading] = useState(false);
  const displayed = historic ?? bundle;
  const change = (i: number, key: keyof Reference, value: string) =>
    setDocuments((current) =>
      current.map((d, index) => (i === index ? { ...d, [key]: value } : d)),
    );
  const begin = () => {
    setDocuments(
      bundle?.documents.map((d) => ({ ...d })) ?? [
        { id: 'public-faq', title: '', body: '', url: '' },
      ],
    );
    setEditVersion(workspace?.version ?? 0);
    setEditing(true);
  };
  const problem = referenceProblem(documents);
  const publish = async () => {
    if (!workspace || problem) return;
    try {
      const normalized = normalizeReferences(documents);
      const hash = await digest(normalized);
      stage({
        method: 'publish_references',
        args: [workspace.id, editVersion, JSON.stringify(normalized), true],
        title: `Publish reference version ${editVersion + 1}`,
        workspace: workspace.id,
        containsPublicText: true,
        details: [
          `${normalized.length} references replace the active bundle. Earlier versions stay readable.`,
          ...normalized.map((d) => `${d.title}\n${d.body}\n${d.url}`),
          'Existing answer cards will need a fresh check.',
        ],
        effect: {
          method: 'get_references',
          args: [workspace.id, editVersion + 1],
          fields: { digest: hash, version: editVersion + 1 },
        },
      });
    } catch (e) {
      onError(e);
    }
  };
  return (
    <Tabs defaultValue="sources">
      <TabsList className="sub-tabs">
        <TabsTrigger value="sources">References</TabsTrigger>
        <TabsTrigger value="cards">
          Answer cards{workspace ? ` · ${workspace.card_count}` : ''}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="sources" keepMounted>
        <section className="panel">
          <div className="panel-heading">
            <h2>Public references</h2>
            {workspace && canEdit(role) && !workspace.archived && !editing && (
              <Button disabled={busy} onClick={begin}>
                <Plus /> {bundle ? 'Edit references' : 'Add references'}
              </Button>
            )}
          </div>
          {!workspace ? (
            <Empty title="Choose a workspace" icon={<BookOpen size={32} />}>
              <p>
                Open a workspace to view its references when live reviews are
                available.
              </p>
            </Empty>
          ) : (
            <>
              <p className="muted">
                The team attests to this text. Attribution links are not fetched
                or independently verified.
              </p>
              {editing ? (
                <div className="reference-editor">
                  {workspace.version !== editVersion && (
                    <Notice kind="warning">
                      Version {workspace.version} is now active. Your draft is
                      preserved, but cannot overwrite it. Close the editor and
                      reopen the current references before publishing.
                    </Notice>
                  )}
                  {documents.map((doc, i) => (
                    <fieldset className="reference-edit-card" key={i}>
                      <legend>Reference {i + 1}</legend>
                      <div className="two-fields">
                        <Field
                          label="Reference ID"
                          id={`ref-id-${i}`}
                          value={doc.id}
                          onChange={(e) => change(i, 'id', e.target.value)}
                          maxLength={64}
                        />
                        <Field
                          label="Title"
                          id={`ref-title-${i}`}
                          value={doc.title}
                          onChange={(e) => change(i, 'title', e.target.value)}
                          maxLength={100}
                        />
                      </div>
                      <label htmlFor={`ref-body-${i}`}>
                        Public reference text
                      </label>
                      <Textarea
                        id={`ref-body-${i}`}
                        value={doc.body}
                        onChange={(e) => change(i, 'body', e.target.value)}
                        className="reference-body-input"
                      />
                      <p className="muted">
                        {utf8(doc.body.trim()).toLocaleString()} / 6,000 bytes
                      </p>
                      <Field
                        label="Attribution URL (optional)"
                        id={`ref-url-${i}`}
                        value={doc.url}
                        onChange={(e) => change(i, 'url', e.target.value)}
                        placeholder="https://example.org/public-faq"
                      />
                      <Button
                        variant="ghost"
                        disabled={documents.length === 1}
                        onClick={() =>
                          setDocuments(
                            documents.filter((_, index) => index !== i),
                          )
                        }
                      >
                        <Trash2 /> Remove reference {i + 1}
                      </Button>
                    </fieldset>
                  ))}
                  <div className="button-row">
                    <Button
                      variant="outline"
                      disabled={documents.length >= 6}
                      onClick={() =>
                        setDocuments([
                          ...documents,
                          {
                            id: `reference-${crypto.randomUUID().slice(0, 8)}`,
                            title: '',
                            body: '',
                            url: '',
                          },
                        ])
                      }
                    >
                      <Plus /> Add reference
                    </Button>
                    <Button
                      disabled={
                        busy || !!problem || workspace.version !== editVersion
                      }
                      onClick={() => void publish()}
                    >
                      Review publication <ArrowUpRight />
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>
                      Close editor (discard draft)
                    </Button>
                  </div>
                  {problem && (
                    <p className="muted" aria-live="polite">
                      {problem}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {workspace.version > 1 && (
                    <form
                      className="version-picker"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setReading(true);
                        try {
                          const n = Number(version);
                          if (
                            !Number.isSafeInteger(n) ||
                            n < 1 ||
                            n > workspace.version
                          )
                            throw new Error(
                              'ReplyCheck: Choose an existing reference version.',
                            );
                          setHistoric(
                            await read<Bundle>('get_references', [
                              workspace.id,
                              n,
                            ]),
                          );
                        } catch (error) {
                          onError(error);
                        } finally {
                          setReading(false);
                        }
                      }}
                    >
                      <Field
                        label="View version"
                        id="view-version"
                        type="number"
                        value={version}
                        min={1}
                        max={workspace.version}
                        placeholder={String(workspace.version)}
                        onChange={(e) => setVersion(e.target.value)}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={reading || !version}
                      >
                        View
                      </Button>
                      {historic && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setHistoric(null)}
                        >
                          Return to current
                        </Button>
                      )}
                    </form>
                  )}
                  {displayed ? (
                    <>
                      <div className="bundle-meta">
                        <span className="pill">
                          Version {displayed.version}
                          {displayed.version !== workspace.version
                            ? ' · Historical'
                            : ''}
                        </span>
                        <span className="muted">
                          <Timestamp value={displayed.published_at} />
                        </span>
                      </div>
                      <div className="reference-list">
                        {displayed.documents.map((d) => (
                          <article className="reference-read-card" key={d.id}>
                            <div className="panel-heading">
                              <div className="reference-entry">
                                <span className="source-icon">
                                  <FileText size={19} />
                                </span>
                                <h3>{d.title}</h3>
                              </div>
                              <Attribution url={d.url} />
                            </div>
                            <p className="preserve-whitespace">{d.body}</p>
                            <p className="muted">Reference ID: {d.id}</p>
                          </article>
                        ))}
                      </div>
                      <div className="button-row">
                        <DownloadButton
                          value={displayed}
                          name={`replycheck-${workspace.id}-v${displayed.version}.json`}
                        />
                        <span className="muted mono" title={displayed.digest}>
                          SHA-256 {short(displayed.digest)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <Empty
                      title="No references yet"
                      icon={<BookOpen size={30} />}
                    >
                      <p>
                        {canEdit(role)
                          ? 'Add the public information your team’s replies should follow.'
                          : 'An owner or editor needs to publish the first reference bundle.'}
                      </p>
                    </Empty>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </TabsContent>
      <TabsContent value="cards" keepMounted>
        <section className="panel">
          <div className="panel-heading">
            <h2>Approved answers</h2>
            <span className="pill">Version-linked</span>
          </div>
          <div className="filter-row">
            <Field
              id="card-search"
              label="Filter loaded cards"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or reply…"
            />
            <div className="field">
              <label htmlFor="card-filter">Status</label>
              <NativeSelect
                id="card-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="NEEDS_RECHECK">Needs recheck</option>
                <option value="RETIRED">Retired</option>
              </NativeSelect>
            </div>
          </div>
          <div className="answer-grid">
            {cards
              .filter(
                (c) =>
                  (filter === 'all' || c.status === filter) &&
                  `${c.title} ${c.draft}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((card) => (
                <article className="answer-card" key={card.id}>
                  <div className="panel-heading">
                    <h3>{card.title}</h3>
                    <span
                      className={`pill ${card.status === 'NEEDS_RECHECK' ? 'stale' : ''}`}
                    >
                      {card.status.toLowerCase().replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p>{card.draft}</p>
                  <p className="muted">
                    v{card.version} · approved by {short(card.approved_by)}
                  </p>
                  <div className="button-row">
                    {card.status !== 'RETIRED' && (
                      <Button
                        variant="outline"
                        onClick={() => reuse(card.question, card.draft)}
                      >
                        {card.status === 'APPROVED'
                          ? 'Use in draft'
                          : 'Recheck reply'}
                      </Button>
                    )}
                    {card.status === 'APPROVED' && (
                      <CopyButton value={card.draft} />
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => openReview(card.review_id)}
                    >
                      View review
                    </Button>
                    {workspace &&
                      canApprove(role) &&
                      !workspace.archived &&
                      card.status !== 'RETIRED' && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            stage({
                              method: 'retire_answer_card',
                              args: [workspace.id, card.id],
                              workspace: workspace.id,
                              title: 'Retire answer card',
                              details: [
                                card.title,
                                'The card and its review stay in history. It will no longer be offered as an approved answer.',
                              ],
                              effect: {
                                method: 'get_answer_card',
                                args: [workspace.id, card.id],
                                fields: { retired: true, id: card.id },
                              },
                            })
                          }
                        >
                          <Trash2 /> Retire
                        </Button>
                      )}
                  </div>
                </article>
              ))}
          </div>
          {!cards.length && (
            <Empty title="No approved answers yet">
              <p>
                Check a reply, then ask an owner or reviewer to approve a
                matching result.
              </p>
            </Empty>
          )}
          {!!cards.length &&
            !cards.some(
              (c) =>
                (filter === 'all' || c.status === filter) &&
                `${c.title} ${c.draft}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            ) && <p className="muted">No loaded cards match these filters.</p>}
          {more && (
            <Button variant="outline" disabled={busy} onClick={loadMore}>
              Load older cards
            </Button>
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
