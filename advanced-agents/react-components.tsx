// ═══════════════════════════════════════════════════════════════════════════
// React Components for AR Prime Market - Advanced
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';

// 1️⃣ ProductCard with Price Psychology
export function ProductCard({ product }: any) {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      
      {product.discount_percent && (
        <div className="price-section">
          <div className="original-price">
            <strike>${product.original_price}</strike>
          </div>
          <div className="sale-price">
            ${product.sale_price}
            <span className="discount-badge">-{product.discount_percent}%</span>
          </div>
          <div className="savings">
            সাশ্রয়: ${(product.original_price - product.sale_price).toFixed(2)}
          </div>
        </div>
      )}
      
      {product.reviews_rating && (
        <div className="rating">
          {'⭐'.repeat(Math.round(product.reviews_rating))}
          ({product.reviews_count} reviews)
        </div>
      )}
      
      {product.stock <= 5 && (
        <div className="scarcity-alert">
          ⚠️ শুধু {product.stock}টি বাকি!
        </div>
      )}
      
      <button className="add-to-cart">কার্টে যোগ করুন</button>
    </div>
  );
}

// 2️⃣ RecommendedProducts
export function RecommendedProducts({ productId }: any) {
  const [recommendations, setRecommendations] = React.useState([]);

  React.useEffect(() => {
    fetchRecommendations(productId);
  }, [productId]);

  return (
    <div className="recommended-products">
      <h3>এই পণ্যের সাথে কেনা হয়:</h3>
      <div className="product-grid">
        {recommendations.map((product: any) => (
          <div key={product.id} className="recommendation-card">
            <img src={product.image} alt={product.name} />
            <h4>{product.name}</h4>
            <div className="price">
              <strike>${product.price}</strike>
              <strong>${(product.price * 0.8).toFixed(2)}</strong>
              <span className="discount">-20%</span>
            </div>
            <button>যোগ করুন</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3️⃣ CustomerSegmentBanner
export function CustomerSegmentBanner({ customer }: any) {
  const segmentMessages: any = {
    new: "স্বাগতম! প্রথম অর্ডারে 10% ছাড়",
    repeat: "আপনার পছন্দের পণ্যগুলি আপডেট হয়েছে",
    vip: "👑 VIP সদস্যের জন্য এক্সক্লুসিভ অফার",
    at_risk: "আমরা আপনাকে মিস করছি! 15% ছাড়",
    inactive: "ফিরে আসুন এবং 20% ছাড় পান",
  };

  return (
    <div className={`segment-banner ${customer.segment_type}`}>
      {segmentMessages[customer.segment_type]}
    </div>
  );
}

// 4️⃣ PaymentOptions
export function PaymentOptions() {
  const [selectedPayment, setSelectedPayment] = React.useState('card');

  return (
    <div className="payment-options">
      <label>
        <input type="radio" value="card" checked={selectedPayment === 'card'} onChange={(e) => setSelectedPayment(e.target.value)} />
        💳 ক্রেডিট কার্ড (30 সেকেন্ড)
      </label>
      <label>
        <input type="radio" value="mobile" checked={selectedPayment === 'mobile'} onChange={(e) => setSelectedPayment(e.target.value)} />
        📱 bKash/Nagad (জনপ্রিয়) ✨
      </label>
      <label>
        <input type="radio" value="cod" checked={selectedPayment === 'cod'} onChange={(e) => setSelectedPayment(e.target.value)} />
        🚚 ডেলিভারিতে পরিশোধ
      </label>
      <label>
        <input type="radio" value="installment" checked={selectedPayment === 'installment'} onChange={(e) => setSelectedPayment(e.target.value)} />
        📊 3 মাসে কিস্তি
      </label>
    </div>
  );
}

// 5️⃣ SupportChat
export function SupportChat() {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');

  const handleSend = async () => {
    // এজেন্ট API কল করুন
    const response = await fetch('/api/support', {
      method: 'POST',
      body: JSON.stringify({ message: input }),
    });
    const data = await response.json();
    setMessages([...messages, { user: input, agent: data.response }]);
    setInput('');
  };

  return (
    <div className="support-chat">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <p className="user">আপনি: {msg.user}</p>
            <p className="agent">এজেন্ট: {msg.agent}</p>
          </div>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="আপনার প্রশ্ন লিখুন..." />
      <button onClick={handleSend}>পাঠান</button>
    </div>
  );
}

async function fetchRecommendations(productId: string) {
  // এজেন্ট API থেকে সুপারিশ পান
}

