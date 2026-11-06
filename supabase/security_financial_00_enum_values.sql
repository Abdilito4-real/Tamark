alter type public.payment_status add value if not exists 'initiated';
alter type public.payment_status add value if not exists 'successful';
alter type public.payment_status add value if not exists 'abandoned';
alter type public.payment_status add value if not exists 'reversed';
alter type public.payment_status add value if not exists 'refunded';
alter type public.payment_status add value if not exists 'partially_refunded';
