
-- PUBLIC READ TABLES
CREATE POLICY "Public read blog_categories" ON public.blog_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage blog_categories" ON public.blog_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read approved comments" ON public.blog_comments FOR SELECT TO anon, authenticated USING (is_approved = true);
CREATE POLICY "Users read own comments" ON public.blog_comments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own comments" ON public.blog_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own comments" ON public.blog_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own comments" ON public.blog_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage blog_comments" ON public.blog_comments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read active campaigns" ON public.campaigns FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read faq_categories" ON public.faq_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage faq_categories" ON public.faq_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read faq_items" ON public.faq_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage faq_items" ON public.faq_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read help_articles" ON public.help_articles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage help_articles" ON public.help_articles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read help_categories" ON public.help_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage help_categories" ON public.help_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read active promotions" ON public.promotions FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage promotions" ON public.promotions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- OWNER-ONLY TABLES
CREATE POLICY "Users read own abandoned_carts" ON public.abandoned_carts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own abandoned_carts" ON public.abandoned_carts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own abandoned_carts" ON public.abandoned_carts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own abandoned_carts" ON public.abandoned_carts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage abandoned_carts" ON public.abandoned_carts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own chat_sessions" ON public.chat_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own chat_sessions" ON public.chat_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own chat_sessions" ON public.chat_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage chat_sessions" ON public.chat_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read messages in own sessions" ON public.chat_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));
CREATE POLICY "Users insert own chat_messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Admins manage chat_messages" ON public.chat_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own return_requests" ON public.return_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own return_requests" ON public.return_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage return_requests" ON public.return_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE POLICY "Users read own support_tickets" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own support_tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage support_tickets" ON public.support_tickets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ADMIN-ONLY
CREATE POLICY "Admins manage cart_reminder_logs" ON public.cart_reminder_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage email_logs" ON public.email_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ai_activity_log" ON public.ai_activity_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ai_engine_logs" ON public.ai_engine_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ai_knowledge_updates" ON public.ai_knowledge_updates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ai_learning_log" ON public.ai_learning_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ai_marketing_strategies" ON public.ai_marketing_strategies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage ai_scan_results" ON public.ai_scan_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
