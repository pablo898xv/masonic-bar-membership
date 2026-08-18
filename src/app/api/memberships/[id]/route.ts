import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const result = await membershipsCollection.findByIdWithRelations(id)
    
    if (!result) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching membership:', error)
    return NextResponse.json({ error: 'Failed to fetch membership' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const existingMembership = await membershipsCollection.findById(id)
    if (!existingMembership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    const allowedFields = ['status', 'notes']
    const updateData: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }
    
    const membership = await membershipsCollection.update(id, updateData)
    
    return NextResponse.json(membership)
  } catch (error) {
    console.error('Error updating membership:', error)
    return NextResponse.json({ error: 'Failed to update membership' }, { status: 500 })
  }
}
