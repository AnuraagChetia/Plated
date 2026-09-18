# KhaoKa client walkthrough

Open http://127.0.0.1:3000/r/khaoka for the showcase. It uses the actual restaurant, seven real menu items, uploaded branding, and clearly labeled sample feedback to fill the six-card review carousel. Real reviews always take priority. Sample feedback is presentation-only and does not change database ratings, dashboard metrics, or completed orders.

KhaoKa is the dedicated demo restaurant; there is no separate preview mode. Other restaurants do not receive sample feedback.

## Suggested five-minute demo

1. **Branding:** Show the cover, circular logo, restaurant story, and mobile avatar menu.
2. **Menu:** Switch between Mains, Sides, Desserts, and Drinks; search for Masor Tenga. Illustrations fill missing photos without pretending to be dish photography. Owners can replace them with real uploaded photos.
3. **Feedback:** Show the six-card carousel and automatic movement. Visitors can also swipe or scroll through reviews. Identify sample cards as fictional demo feedback.
4. **Account:** Open My profile to demonstrate contact details and address management. Use a presenter-owned account; avoid projecting real customers’ saved details.
5. **Ordering:** KhaoKa is currently paused. Explain the prominent notice and disabled ordering. To demonstrate checkout, the owner must enable Accept new orders in Dashboard → Settings and check pickup/delivery details and operating hours. A submitted order is real application data, even when used in a demo.
6. **Confirmation:** After an authorized test order, show the private tracking-link modal, copy action, latest-order floating button, and signed-in order history. Save guest links before closing the browser.
7. **Owner operations:** Show the new order in the dashboard and progress it through Preparing → Ready → Completed. Demonstrate opening hours and manual pause controls.

## Before presenting

- Start the application server and confirm Supabase is reachable. Authentication depends on the network; intermittent connection resets may require retrying.
- Choose desktop or mobile size. Reviews show three, two, or one card to suit the screen.
- Decide whether ordering should remain paused; no operational setting was changed for this showcase.
- Payments and WhatsApp notifications are not integrated. Orders use direct payment and an in-app private tracking link.
- No fictional customers, completed orders, addresses, or financial metrics were seeded.
