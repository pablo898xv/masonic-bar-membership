'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

type UserRow = {
  id: string
  name: string
  email: string
  tenantRole: string
  isPlatformAdmin?: boolean
  isActive?: boolean
  totpEnabled?: boolean
}

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
]

function roleLabel(role: string) {
  const match = ROLE_OPTIONS.find((option) => option.value === role)
  return match?.label || role
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [meId, setMeId] = useState('')
  const [mePlatform, setMePlatform] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('MANAGER')
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(false)
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('MANAGER')
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('')
  const [disableTotp, setDisableTotp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = async () => {
    const [usersRes, meRes] = await Promise.all([fetch('/api/users'), fetch('/api/auth/me')])
    const usersData = await usersRes.json()
    const meData = await meRes.json().catch(() => ({}))
    setUsers(usersData.users || [])
    setMeId(meData.user?.id || '')
    setMePlatform(Boolean(meData.user?.isPlatformAdmin))
  }

  useEffect(() => {
    void load()
  }, [])

  const openEdit = (user: UserRow) => {
    setSelected(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditRole(user.tenantRole || 'MANAGER')
    setEditActive(user.isActive !== false)
    setEditPassword('')
    setEditPasswordConfirm('')
    setDisableTotp(false)
    setEditError('')
  }

  const closeEdit = () => {
    setSelected(null)
    setEditError('')
    setSaving(false)
    setRemoving(false)
  }

  const addUser = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setMessageOk(false)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'Failed to add user')
      return
    }
    setName('')
    setEmail('')
    setPassword('')
    setMessageOk(true)
    setMessage('User added to this venue.')
    await load()
  }

  const saveUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setEditError('')
    if (editPassword && editPassword !== editPasswordConfirm) {
      setEditError('The new passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          lockSignIn
            ? { role: editRole }
            : {
                name: editName,
                email: editEmail,
                role: editRole,
                isActive: editActive,
                password: editPassword,
                disableTotp: disableTotp || undefined,
              }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user')
      setMessageOk(true)
      setMessage(
        editPassword
          ? `${data.user?.name || 'User'} can now sign in with the new password.`
          : 'User updated.'
      )
      closeEdit()
      await load()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async () => {
    if (!selected) return
    if (!window.confirm(`Remove ${selected.name} from this venue? They keep their account if they belong to another venue.`)) {
      return
    }
    setRemoving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/users/${selected.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to remove user')
      setMessageOk(true)
      setMessage(`${selected.name} was removed from this venue.`)
      closeEdit()
      await load()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to remove user')
    } finally {
      setRemoving(false)
    }
  }

  const selectedIsMe = selected?.id === meId
  const lockSignIn = Boolean(selected?.isPlatformAdmin && !mePlatform)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">
          Staff can belong to one or more venues. Switch venue in the sidebar. Password and 2FA apply to their sign-in everywhere.
        </p>
      </div>

      {message && (
        <p
          className={`text-sm rounded-lg p-3 border ${
            messageOk
              ? 'text-green-800 bg-green-50 border-green-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Add user to this venue</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={addUser} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Input
              label="Password (new users only)"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Select
              label="Venue role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              options={ROLE_OPTIONS}
            />
            <div className="md:col-span-2">
              <Button type="submit">Add user</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {users.length === 0 && <p className="text-sm text-gray-500">No users linked to this venue yet.</p>}
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="default">{roleLabel(user.tenantRole)}</Badge>
                  {user.isPlatformAdmin ? <Badge variant="info">Platform</Badge> : null}
                  {user.isActive === false ? <Badge variant="warning">Inactive</Badge> : null}
                  {user.totpEnabled ? <Badge variant="success">2FA</Badge> : null}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => openEdit(user)} className="w-full sm:w-auto">
                Edit
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Modal isOpen={!!selected} onClose={closeEdit} title={selected ? `Edit ${selected.name}` : 'Edit user'}>
        {selected && (
          <form onSubmit={saveUser} className="space-y-4">
            {lockSignIn && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                This is a platform administrator. You can change their role at this venue. Sign-in details can only be changed by another platform admin.
              </p>
            )}
            <Input
              label="Name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              required
              disabled={lockSignIn}
            />
            <Input
              label="Email"
              type="email"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
              required
              disabled={lockSignIn}
            />
            <Select
              label="Venue role"
              value={editRole}
              onChange={(event) => setEditRole(event.target.value)}
              options={ROLE_OPTIONS}
            />
            <label className={`flex items-center gap-2 text-sm text-gray-700 ${lockSignIn || selectedIsMe ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={editActive}
                disabled={lockSignIn || selectedIsMe}
                onChange={(event) => setEditActive(event.target.checked)}
              />
              Can sign in
            </label>
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">Reset password</p>
              <p className="text-xs text-gray-500">
                Leave blank to keep the current password. A reset signs them out of other sessions.
              </p>
              <Input
                label="New password"
                type="password"
                value={editPassword}
                onChange={(event) => {
                  const value = event.target.value
                  setEditPassword(value)
                  if (selected.totpEnabled && value) setDisableTotp(true)
                }}
                autoComplete="new-password"
                disabled={lockSignIn}
              />
              <Input
                label="Confirm new password"
                type="password"
                value={editPasswordConfirm}
                onChange={(event) => setEditPasswordConfirm(event.target.value)}
                autoComplete="new-password"
                disabled={lockSignIn}
              />
              {selected.totpEnabled && (
                <label className={`flex items-start gap-2 text-sm text-gray-700 ${lockSignIn ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={disableTotp}
                    disabled={lockSignIn}
                    onChange={(event) => setDisableTotp(event.target.checked)}
                  />
                  <span>Turn off two-factor authentication so they can sign in with the new password.</span>
                </label>
              )}
            </div>
            {editError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{editError}</p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => void removeUser()}
                loading={removing}
                disabled={saving || (selectedIsMe && !mePlatform)}
              >
                Remove from venue
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button type="button" variant="secondary" onClick={closeEdit}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} disabled={removing}>
                  Save
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
