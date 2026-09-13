'use client';
import { useState } from 'react';
import { Users, UserPlus, Archive, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { isAddress, roleDescription, short } from '@/lib/reply/core';
import type { Address, Operation, Role, Workspace } from '@/lib/reply/types';
import { Field, Notice, Empty } from './common';

export function Team({
  workspace,
  account,
  role,
  invitation,
  proposed,
  members,
  busy,
  stage,
}: {
  workspace: Workspace | null;
  account: Address | null;
  role: Role;
  invitation: string;
  proposed: string;
  members: { address: Address; role: Role }[];
  busy: boolean;
  stage: (op: Operation) => void;
}) {
  const [target, setTarget] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [nextOwner, setNextOwner] = useState('');
  if (!workspace)
    return (
      <section className="panel">
        <Empty title="No workspace selected" icon={<Users size={32} />}>
          <p>Open a public workspace to view its roles and ownership.</p>
        </Empty>
      </section>
    );
  const action = (
    method: string,
    args: (string | boolean)[],
    title: string,
    details: string[],
    effect: Operation['effect'],
  ) =>
    stage({
      method,
      args: [workspace.id, ...args],
      workspace: workspace.id,
      title,
      details,
      effect,
    });
  const owner = role === 'owner';
  return (
    <div className="review-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PEOPLE & PERMISSIONS</span>
            <h2>{workspace.name}</h2>
          </div>
          <Users size={23} />
        </div>
        <Notice>
          You are a {role}. {roleDescription[role]}
        </Notice>
        {account && invitation && !workspace.archived && (
          <div className="invitation">
            <h3>You’re invited as {invitation}</h3>
            <p>{roleDescription[invitation as Role]}</p>
            <Button
              disabled={busy}
              onClick={() =>
                action(
                  'accept_invitation',
                  [],
                  'Accept workspace role',
                  [
                    `Accept the ${invitation} role in ${workspace.name}. Your wallet address will be public.`,
                  ],
                  {
                    method: 'get_role',
                    args: [workspace.id, account],
                    equals: invitation,
                  },
                )
              }
            >
              Accept role
            </Button>
          </div>
        )}
        <div className="member-list">
          <div>
            <span className="member-avatar">O</span>
            <div>
              <strong>Workspace owner</strong>
              <p className="mono muted">{workspace.owner}</p>
            </div>
            <span className="pill">owner</span>
          </div>
          {members.map((member) => (
            <div key={member.address}>
              <span className="member-avatar">
                {member.role.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong title={member.address}>{short(member.address)}</strong>
                <p className="muted">{roleDescription[member.role]}</p>
              </div>
              {owner && !workspace.archived && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    action(
                      'remove_member',
                      [member.address],
                      'Remove workspace access',
                      [
                        member.address,
                        'Any outstanding invitation for this wallet will also be canceled. Existing public reviews stay readable.',
                      ],
                      {
                        method: 'get_role',
                        args: [workspace.id, member.address],
                        equals: 'visitor',
                      },
                    )
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {owner && !workspace.archived && (
          <form
            className="team-form"
            onSubmit={(e) => {
              e.preventDefault();
              const address = target.trim().toLowerCase();
              if (!isAddress(address)) return;
              action(
                'invite_member',
                [address, inviteRole],
                'Invite a team member',
                [
                  `${address} as ${inviteRole}.`,
                  roleDescription[inviteRole as Role],
                  'The wallet must explicitly accept before this new role takes effect.',
                ],
                {
                  method: 'get_invitation',
                  args: [workspace.id, address],
                  equals: inviteRole,
                },
              );
            }}
          >
            <h3>Invite or change a role</h3>
            <Field
              label="Wallet address"
              id="invite-wallet"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0x…"
            />
            <div className="field">
              <label htmlFor="invite-role">Role</label>
              <NativeSelect
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="member">Member · checks replies</option>
                <option value="editor">Editor · manages references</option>
                <option value="reviewer">
                  Reviewer · approves answer cards
                </option>
              </NativeSelect>
            </div>
            <div className="button-row">
              <Button
                type="submit"
                disabled={
                  busy ||
                  !isAddress(target.trim()) ||
                  target.toLowerCase() === workspace.owner
                }
              >
                <UserPlus /> Review invitation
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy ||
                  !isAddress(target.trim()) ||
                  target.toLowerCase() === workspace.owner
                }
                onClick={() =>
                  action(
                    'remove_member',
                    [target.trim().toLowerCase()],
                    'Revoke wallet access',
                    [
                      `Remove membership and cancel any invitation for ${target.trim()}.`,
                    ],
                    {
                      method: 'get_invitation',
                      args: [workspace.id, target.trim().toLowerCase()],
                      equals: '',
                    },
                  )
                }
              >
                Revoke access / invitation
              </Button>
            </div>
          </form>
        )}
      </section>
      <aside className="reference-column">
        <section className="panel">
          <h2>Ownership</h2>
          <p className="muted">
            Transfers take two steps. The nominated wallet must accept. The
            previous owner loses owner access.
          </p>
          {proposed && (
            <div className="invitation">
              <p>Proposed owner</p>
              <p className="mono">{proposed}</p>
              {account === proposed && !workspace.archived && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(
                      'accept_ownership',
                      [],
                      'Accept workspace ownership',
                      [
                        `Become the owner of ${workspace.name}. The previous owner will lose management access.`,
                      ],
                      {
                        method: 'get_workspace',
                        args: [workspace.id],
                        fields: { owner: account },
                      },
                    )
                  }
                >
                  Accept ownership
                </Button>
              )}
              {owner && !workspace.archived && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    action(
                      'cancel_owner_transfer',
                      [],
                      'Cancel ownership transfer',
                      [`Cancel the pending transfer to ${proposed}.`],
                      {
                        method: 'get_proposed_owner',
                        args: [workspace.id],
                        equals: '',
                      },
                    )
                  }
                >
                  Cancel transfer
                </Button>
              )}
            </div>
          )}
          {owner && !workspace.archived && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const address = nextOwner.trim().toLowerCase();
                if (!isAddress(address)) return;
                action(
                  'propose_owner',
                  [address],
                  'Propose a new owner',
                  [
                    address,
                    'You remain owner until this wallet accepts. Check the complete address carefully.',
                  ],
                  {
                    method: 'get_proposed_owner',
                    args: [workspace.id],
                    equals: address,
                  },
                );
              }}
            >
              <Field
                label="New owner’s wallet"
                id="next-owner"
                value={nextOwner}
                onChange={(e) => setNextOwner(e.target.value)}
                placeholder="0x…"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={
                  busy ||
                  !isAddress(nextOwner.trim()) ||
                  nextOwner.toLowerCase() === workspace.owner
                }
              >
                <ArrowRightLeft /> Review transfer
              </Button>
            </form>
          )}
        </section>
        <section className="panel">
          <h2>
            {workspace.archived ? 'Archived workspace' : 'Workspace status'}
          </h2>
          <p className="muted">
            Archiving stops new work and pauses answer-card approval status.
            Public records remain readable. The owner can restore access.
          </p>
          {owner && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                action(
                  'set_archived',
                  [!workspace.archived],
                  workspace.archived
                    ? 'Restore workspace'
                    : 'Archive workspace',
                  [
                    workspace.archived
                      ? 'Enable work again. Cards matching the current references become active again.'
                      : 'Stop new submissions, invitations and publications. This does not erase public information.',
                  ],
                  {
                    method: 'get_workspace',
                    args: [workspace.id],
                    fields: { archived: !workspace.archived },
                  },
                )
              }
            >
              <Archive />
              {workspace.archived ? 'Restore workspace' : 'Archive workspace'}
            </Button>
          )}
        </section>
      </aside>
    </div>
  );
}
