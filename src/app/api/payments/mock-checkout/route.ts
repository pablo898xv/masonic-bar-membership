import { NextRequest, NextResponse } from 'next/server'

/**
 * Mock checkout page for development/testing when Pixl Pay is not configured
 * This simulates the payment flow and returns to the application
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const txn = searchParams.get('txn')
  const amount = searchParams.get('amount')
  const method = searchParams.get('method')
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mock Payment - Pixl Pay</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 500px;
          margin: 100px auto;
          padding: 20px;
          text-align: center;
          background: #f5f5f5;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-bottom: 10px; }
        .amount { font-size: 32px; color: #2563eb; margin: 20px 0; }
        .method { color: #666; margin-bottom: 30px; }
        .btn {
          display: inline-block;
          padding: 15px 40px;
          margin: 10px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          cursor: pointer;
          border: none;
          font-size: 16px;
        }
        .btn-success { background: #10b981; color: white; }
        .btn-danger { background: #ef4444; color: white; }
        .btn:hover { opacity: 0.9; }
        .mock-notice {
          margin-top: 30px;
          padding: 15px;
          background: #fef3c7;
          border-radius: 8px;
          font-size: 14px;
          color: #92400e;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Pixl Pay</h1>
        <p class="method">Payment Method: ${method === 'OPEN_BANKING' ? 'Open Banking' : 'Card Payment'}</p>
        <div class="amount">£${parseFloat(amount || '0').toFixed(2)}</div>
        <p>Transaction: ${txn}</p>
        
        <form action="${appUrl}/api/payments/mock-complete" method="POST">
          <input type="hidden" name="txn" value="${txn}" />
          <input type="hidden" name="status" value="success" />
          <button type="submit" class="btn btn-success">Simulate Success</button>
        </form>
        
        <form action="${appUrl}/api/payments/mock-complete" method="POST">
          <input type="hidden" name="txn" value="${txn}" />
          <input type="hidden" name="status" value="failed" />
          <button type="submit" class="btn btn-danger">Simulate Failure</button>
        </form>
        
        <div class="mock-notice">
          ⚠️ This is a mock payment page for development.<br>
          Configure PIXL_PAY_API_URL and PIXL_PAY_API_KEY for real payments.
        </div>
      </div>
    </body>
    </html>
  `
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  })
}
