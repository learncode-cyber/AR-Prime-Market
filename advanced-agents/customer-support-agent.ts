
// ═══════════════════════════════════════════════════════════════════════════
// 💬 CUSTOMER SUPPORT AGENT - Advanced Implementation
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface CustomerSegment {
  id: string;
  segment_type: "new" | "repeat" | "vip" | "at_risk" | "inactive";
  lifetime_value: number;
  order_count: number;
  last_order_date: Date;
}

interface SupportTicket {
  id: string;
  customer_id: string;
  issue_type: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: Date;
}

interface PersonalizationProfile {
  customer_id: string;
  tone: "formal" | "casual" | "friendly" | "professional";
  communication_channel: "email" | "sms" | "telegram" | "all";
  response_time_preference: "asap" | "within_24h" | "within_48h";
  language: string;
}

export class CustomerSupportAgent {
  private agent_id = "support-agent-v2";

  // 🎯 গ্রাহক সেগমেন্টেশন
  async segmentCustomers(): Promise<Map<string, CustomerSegment>> {
    console.log("🎯 Segmenting customers...");

    const { data: customers } = await supabase
      .from("customers")
      .select("*");

    const segmentation = new Map<string, CustomerSegment>();

    for (const customer of customers || []) {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", customer.id);

      const order_count = orders?.length || 0;
      const last_order = orders?.[0];
      const total_spent = orders?.reduce(
        (sum: number, o: any) => sum + o.total,
        0
      ) || 0;

      let segment_type = "new";

      if (order_count === 0) {
        segment_type = "new";
      } else if (order_count >= 5) {
        segment_type = "vip";
      } else if (order_count >= 2) {
        segment_type = "repeat";
      } else {
        const days_since = last_order
          ? Math.floor(
              (Date.now() - new Date(last_order.created_at).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 365;

        if (days_since > 90) {
          segment_type = "inactive";
        } else if (days_since > 60) {
          segment_type = "at_risk";
        } else {
          segment_type = "repeat";
        }
      }

      segmentation.set(customer.id, {
        id: customer.id,
        segment_type: segment_type as any,
        lifetime_value: total_spent,
        order_count,
        last_order_date: last_order?.created_at || new Date(),
      });
    }

    return segmentation;
  }

  // 📧 ব্যক্তিগতকৃত যোগাযোগ
  async createPersonalizationProfile(
    customerId: string
  ): Promise<PersonalizationProfile> {
    console.log(`📧 Creating personalization profile for ${customerId}`);

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    // যোগাযোগ পছন্দ সনাক্ত করুন
    const communication_history = await supabase
      .from("communications")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10);

    // টোন নির্ধারণ করুন
    const tone = this.determineTone(customer, communication_history.data || []);

    // যোগাযোগ চ্যানেল নির্ধারণ করুন
    const communication_channel = this.determineChannel(
      customer,
      communication_history.data || []
    );

    const profile: PersonalizationProfile = {
      customer_id: customerId,
      tone,
      communication_channel,
      response_time_preference: customer.response_time_preference || "within_24h",
      language: customer.language || "bengali",
    };

    // সংরক্ষণ করুন
    await supabase
      .from("personalization_profiles")
      .upsert([profile], { onConflict: "customer_id" });

    return profile;
  }

  // 🤖 স্বয়ংক্রিয় প্রতিক্রিয়া সিস্টেম
  async handleSupportTicket(ticketId: string): Promise<void> {
    console.log(`🤖 Handling support ticket: ${ticketId}`);

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    // প্রাথমিক সমস্যা বিশ্লেষণ
    const issue_category = this.categorizeIssue(ticket.issue_type);

    // স্বয়ংক্রিয় প্রতিক্রিয়া সম্ভব কিনা চেক করুন
    if (this.canAutoResolve(issue_category)) {
      await this.sendAutomatedResponse(ticket, issue_category);
      await this.updateTicketStatus(ticketId, "resolved");
    } else {
      // এসকেলেট করুন
      await this.escalateToHuman(ticket);
    }
  }

  // 💝 রিটার্ন এবং এক্সচেঞ্জ প্রসেসিং
  async handleReturnRequest(orderId: string): Promise<void> {
    console.log(`💝 Processing return request for order: ${orderId}`);

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    // রিটার্ন যোগ্যতা চেক করুন
    const days_since_delivery = Math.floor(
      (Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (days_since_delivery <= 30) {
      // ফেরত অনুমোদন করুন
      const return_request = {
        order_id: orderId,
        customer_id: order.customer_id,
        reason: "customer_initiated",
        status: "approved",
        refund_amount: order.total,
        return_shipping_label: await this.generateReturnLabel(order),
        created_at: new Date(),
      };

      await supabase.from("return_requests").insert([return_request]);

      // গ্রাহককে বিজ্ঞপ্তি দিন
      await this.notifyReturnApproved(order.customer_id, return_request);
    } else {
      // ফেরত অস্বীকার করুন
      await this.denyReturn(orderId, "Outside 30-day return window");
    }
  }

  // 📞 প্রতিক্রিয়া সময় অপ্টিমাইজেশন
  async optimizeResponseTime(): Promise<void> {
    console.log("📞 Optimizing response times...");

    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: true });

    for (const ticket of tickets || []) {
      const priority = this.calculatePriority(ticket);
      const assigned_to = this.assignToTeamMember(priority);

      await supabase
        .from("support_tickets")
        .update({
          priority,
          assigned_to,
          target_response_time: this.getTargetResponseTime(priority),
        })
        .eq("id", ticket.id);
    }
  }

  // 🎁 গ্রাহক আনুগত্য ট্র্যাকিং
  async trackLoyalty(customerId: string): Promise<void> {
    console.log(`🎁 Tracking loyalty for customer: ${customerId}`);

    const segment = await this.getCustomerSegment(customerId);
    const lifetime_value = await this.calculateLifetimeValue(customerId);

    // পুরস্কার পয়েন্ট গণনা করুন
    const reward_points = Math.floor(lifetime_value * 0.1); // প্রতি $১ এর জন্য ০.১ পয়েন্ট

    // স্তর নির্ধারণ করুন
    const loyalty_tier = this.determineLoyaltyTier(lifetime_value);

    // সুবিধা আপডেট করুন
    const benefits = this.getLoyaltyBenefits(loyalty_tier);

    await supabase
      .from("loyalty_programs")
      .upsert(
        [
          {
            customer_id: customerId,
            reward_points,
            loyalty_tier,
            benefits,
            last_updated: new Date(),
          },
        ],
        { onConflict: "customer_id" }
      );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private determineTone(
    customer: any,
    history: any[]
  ): "formal" | "casual" | "friendly" | "professional" {
    if (customer.vip_status) return "professional";
    if (customer.avg_satisfaction >= 4.5) return "friendly";
    if (customer.order_count >= 5) return "casual";
    return "formal";
  }

  private determineChannel(
    customer: any,
    history: any[]
  ): "email" | "sms" | "telegram" | "all" {
    // সবচেয়ে বেশি ব্যবহৃত চ্যানেল খুঁজুন
    const channels = history.map((h: any) => h.channel);
    const frequency: any = {};

    channels.forEach((c: string) => {
      frequency[c] = (frequency[c] || 0) + 1;
    });

    const preferred = Object.keys(frequency).sort(
      (a, b) => frequency[b] - frequency[a]
    )[0];
    return (preferred as any) || "email";
  }

  private categorizeIssue(
    issue_type: string
  ): "shipping" | "product" | "payment" | "other" {
    if (issue_type.includes("shipping")) return "shipping";
    if (issue_type.includes("product")) return "product";
    if (issue_type.includes("payment")) return "payment";
    return "other";
  }

  private canAutoResolve(category: string): boolean {
    const autoResolvable = ["shipping", "payment"];
    return autoResolvable.includes(category);
  }

  private async sendAutomatedResponse(ticket: any, category: string) {
    const responses: any = {
      shipping:
        "আপনার শিপিং স্ট্যাটাস ট্র্যাক করতে এখানে ক্লিক করুন...",
      payment: "আপনার পেমেন্ট সফল হয়েছে। ধন্যবাদ!",
      product: "আপনার পণ্য সম্পর্কে প্রশ্নের জন্য ধন্যবাদ...",
    };

    console.log(`📧 Sending automated response: ${responses[category]}`);
  }

  private async updateTicketStatus(ticketId: string, status: string) {
    await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date() })
      .eq("id", ticketId);
  }

  private async escalateToHuman(ticket: any) {
    console.log(`👤 Escalating ticket ${ticket.id} to human agent`);
  }

  private async generateReturnLabel(order: any): Promise<string> {
    // বাস্তব বাস্তবায়নে এটি শিপিং API কল হবে
    return `RETURN-${order.id}`;
  }

  private async notifyReturnApproved(customerId: string, return_request: any) {
    console.log(`✅ Notifying customer of approved return`);
  }

  private async denyReturn(orderId: string, reason: string) {
    console.log(`❌ Denying return for order ${orderId}: ${reason}`);
  }

  private calculatePriority(ticket: any): string {
    if (ticket.issue_type.includes("urgent")) return "urgent";
    if (ticket.issue_type.includes("payment")) return "high";
    return "medium";
  }

  private assignToTeamMember(priority: string): string {
    // এন্টারপ্রাইজে এটি লোড ব্যালান্সিং হবে
    return `agent-${priority}`;
  }

  private getTargetResponseTime(priority: string): number {
    const times: any = { urgent: 15, high: 60, medium: 240, low: 1440 };
    return times[priority] || 240;
  }

  private async getCustomerSegment(customerId: string): Promise<string> {
    // সেগমেন্টেশন লজিক
    return "repeat";
  }

  private async calculateLifetimeValue(customerId: string): Promise<number> {
    const { data: orders } = await supabase
      .from("orders")
      .select("total")
      .eq("customer_id", customerId);

    return orders?.reduce((sum: number, o: any) => sum + o.total, 0) || 0;
  }

  private determineLoyaltyTier(
    lifetime_value: number
  ): "bronze" | "silver" | "gold" | "platinum" {
    if (lifetime_value >= 5000) return "platinum";
    if (lifetime_value >= 2000) return "gold";
    if (lifetime_value >= 500) return "silver";
    return "bronze";
  }

  private getLoyaltyBenefits(tier: string): string[] {
    const benefits: any = {
      bronze: ["5% discount"],
      silver: ["10% discount", "free shipping"],
      gold: ["15% discount", "free shipping", "priority support"],
      platinum: [
        "20% discount",
        "free shipping",
        "priority support",
        "exclusive products",
      ],
    };
    return benefits[tier] || [];
  }
}

export const supportAgent = new CustomerSupportAgent();

