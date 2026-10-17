# System Requirements: Digital Menu Platform for Restaurants

Prepared by: Ali Khaled • Version: first draft (v1) • Stack: Next.js + Supabase

## 1. Overview

A SaaS website where any restaurant or café owner builds a digital menu without needing a designer. The owner signs up, picks a template, adds sections, items and prices, and gets a **permanent link** and a **QR code** to print or send to anyone. Customers scan the QR code or open the link on their phone and see the menu.

The problem it solves: a new restaurant needs a menu, and today someone has to design it for them. The platform makes this fast, easy and editable at any time.

## 2. User types

- **Restaurant owner:** creates an account, builds and edits menus, downloads the QR code.
- **Visitor (customer):** opens the public menu without an account, mostly from a phone.
- **Admin (you):** runs the platform, receives custom-template requests, and steps in for technical support.

## 3. Functional requirements

### 3.1 Accounts and login

- **FR-1:** Owners can sign up and log in through Supabase Auth.
- **FR-2:** Each owner can see and edit only their own data, with no access to any other restaurant's data.

### 3.2 Menu management

- **FR-3:** An owner can create a new menu, choosing a template and a language (Arabic or English).
- **FR-4:** Add, edit, delete and reorder **sections** (for example drinks, pizza).
- **FR-5:** Add, edit, delete and reorder **items** inside each section: name, price, description, image.
- **FR-6:** Edits appear on the public menu immediately, without the link or QR code changing.

### 3.3 Templates

- **FR-7:** The first version ships with **two templates**.
- **FR-8:** Each template has its own specific data fields in addition to the shared core fields.
- **FR-9:** An owner can switch templates after starting. The core data carries over to the new template **automatically**.
- **FR-10:** Template-specific fields are stored separately, so switching back to a previous template finds them as they were.
- **FR-11:** A restaurant that wants a custom template contacts the admin directly (a service outside the core system).

### 3.4 Link and QR code

- **FR-12:** Every menu has a public link in a fixed format, containing a name (slug) the owner chooses.
- **FR-13:** The owner chooses the name, reviews it and confirms it once. After confirmation it **can never be changed**, so printed QR codes never break.
- **FR-14:** The confirmation screen must state clearly that the name is final.
- **FR-15:** The name must be unique and follow simple rules (lowercase English letters, digits and hyphens). A reserved-names list (such as admin, api, login) prevents clashes with the site's own pages.
- **FR-16:** Generate a QR code for the link, downloadable as an image ready for printing.
- **FR-17 (proposed):** The admin can change a name in rare technical-support cases only.

### 3.5 Public menu page

- **FR-18:** The menu page opens without login and shows sections and items in the design of the selected template.
- **FR-19:** Support Arabic (RTL) and English (LTR) according to the menu's language.
- **FR-20:** The page is designed mobile-first.

## 4. Non-functional requirements

### Performance

- The public menu page must open quickly even on a weak connection. Proposed target: visible content in under 2 seconds on a 3G network.
- Use caching (ISR or similar) in Next.js instead of reading the database on every visit, and refresh the cache when the owner edits.
- Compress images and limit their size on upload.

### Security

- Enable **Row Level Security** in Supabase so each owner reaches only their own data.
- Validate all input on the server (Server Actions), not only in the browser.
- Validate the type and size of uploaded images.
- Protect entry points from abuse with rate limiting.

### Reliability

- A menu link must keep working as long as the account exists, because the QR code may already be printed.
- Open decision: what happens to the link if the account is deleted or a subscription expires (see open questions).

### Extensibility

- Adding a new template must be a well-defined, easy task that does not require changing the core.
- The architecture starts without a separate Node server, with the option to split out a backend later if the project grows.

## 5. Technical stack

- **Frontend:** Next.js
- **Server logic:** Server Actions and Route Handlers inside Next.js
- **Database, auth and image storage:** Supabase (Postgres + Auth + Storage)
- **Architecture decision:** start without a separate Node.js server, and evolve it later as needed.

## 6. Data model (proposed draft, for review)

This is a first sketch of the tables. We have not reviewed it yet.

- **restaurants:** restaurant details, linked to the owner's account.
- **menus:** the menu. Holds the selected template, the language, and the slug (unique and immutable).
- **sections:** menu sections, with ordering.
- **items:** items inside sections (name, price, description, image, order).
- **template\_extras:** the template-specific fields for each menu, stored in a jsonb column. A separate table so the fields are not lost if the owner switches templates and comes back.
- **templates:** definitions of the available templates and the extra fields of each.

## 7. Out of scope for version 1

- Pricing plans and payments (agreed to postpone until the site is built).
- A custom domain for each restaurant.
- Online ordering or a cart.
- A mobile app.
- View analytics.
- More than two templates.

## 8. Open questions

- Currency: one fixed currency, or chosen by the owner?
- Can one account own more than one restaurant?
- Do menus have draft and published states, or does everything go live immediately?
- If an account is deleted or a subscription expires: does the link stop working, show a message, or keep working? Does the slug stay reserved?
- Are item images part of version 1?
- Can one menu be bilingual (Arabic and English), or is it one language per menu?
- Do we need an "item currently unavailable" option?
