'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

interface SubscriptionPlan {
  id: string
  name: string
  durationYears: number
  price: number
  currency: string
  isActive: boolean
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    durationYears: '1',
    price: '',
    isActive: true
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription-plans')
      const data = await res.json()
      setPlans(data)
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const url = editingPlan
        ? `/api/subscription-plans/${editingPlan.id}`
        : '/api/subscription-plans'
      
      const res = await fetch(url, {
        method: editingPlan ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          durationYears: parseInt(formData.durationYears),
          price: parseFloat(formData.price),
          currency: 'GBP',
          isActive: formData.isActive
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save plan')
      }

      setShowAddModal(false)
      setShowEditModal(false)
      setFormData({ name: '', durationYears: '1', price: '', isActive: true })
      setEditingPlan(null)
      fetchPlans()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      durationYears: plan.durationYears.toString(),
      price: plan.price.toString(),
      isActive: plan.isActive
    })
    setShowEditModal(true)
  }

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      await fetch(`/api/subscription-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !plan.isActive })
      })
      fetchPlans()
    } catch (error) {
      console.error('Error toggling plan:', error)
    }
  }

  const closeModal = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setFormData({ name: '', durationYears: '1', price: '', isActive: true })
    setEditingPlan(null)
    setError('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-500 mt-1">Manage membership pricing and duration options</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Plan
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No subscription plans</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first subscription plan.</p>
              <div className="mt-6">
                <Button onClick={() => setShowAddModal(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    <Badge variant={plan.isActive ? 'success' : 'default'} className="mt-1">
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(plan)}>
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      £{plan.price.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      for {plan.durationYears} year{plan.durationYears > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <Button
                      variant={plan.isActive ? 'secondary' : 'primary'}
                      size="sm"
                      className="w-full"
                      onClick={() => handleToggleActive(plan)}
                    >
                      {plan.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={closeModal}
        title={editingPlan ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}
          
          <Input
            label="Plan Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Annual Membership"
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (Years)"
              type="number"
              min="1"
              max="10"
              value={formData.durationYears}
              onChange={(e) => setFormData({ ...formData, durationYears: e.target.value })}
              required
            />
            <Input
              label="Price (£)"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="e.g., 25.00"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Plan is active and available for purchase
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
