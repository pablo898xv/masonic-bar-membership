'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

type UserRow = {
  id: string
  name: string
  email: string
  tenantRole: string
  isPlatformAdmin?: boolean
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('MANAGER')
  const [message, setMessage] = useState('')

  const load = async () => {
    const res = await fetch('/api/users')
    const data = await res.json()
    setUsers(data.users || [])
  }

  useEffect(() => {
    void load()
  }, [])

  const addUser = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
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
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">Staff can belong to one or more venues. Switch venue in the sidebar.</p>
      </div>

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
              options={[
                { value: 'OWNER', label: 'Owner' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'MANAGER', label: 'Manager' },
              ]}
            />
            <div className="md:col-span-2">
              <Button type="submit">Add user</Button>
            </div>
          </form>
          {message && <p className="text-sm text-red-600 mt-3">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          {users.length === 0 && <p className="text-sm text-gray-500">No users linked to this venue yet.</p>}
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-2 sm:flex-row sm:justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <p className="text-sm text-gray-600">{user.tenantRole}{user.isPlatformAdmin ? ' · platform' : ''}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
