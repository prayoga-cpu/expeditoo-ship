# Changelog

All notable changes to EXPEDITOO are documented here, newest first.

This file is the **source of truth** for releases. `/changelog` and
`GET /api/public/changelog` are rendered from it at build time, and
`pnpm changelog:check` refuses a release whose version does not agree with
`package.json`, `src/lib/version.ts` and `STATUS.md`.

Format: `## [version] - YYYY-MM-DD · tag` where `tag` ∈ `feat | fix | infra | ux`.
Written for the people who use the platform — drivers, operators and clients.
The engineering half of each release lives in [`STATUS.md`](./STATUS.md).

History before `2.0.0` belongs to the v1 goods marketplace and is not recorded:
the first release below is the commit that began the transport pivot.

## [2.40.1] - 2026-09-13 · infra

- **Nothing you can see changes.** The job that applies database changes to the live site could not start: it asked which version of its build tool to use and the project never said, so it stopped before reaching the database. It is fixed, and the answer now lives in one place that both the live checks and the database job read, so the two can no longer drift apart.
- This mattered because the release before it shipped a change the database had not been told about yet. Confirming a pickup or a delivery from inside the app would have failed until the job ran.

## [2.40.0] - 2026-09-10 · feat

- **You can confirm a pickup or a delivery from the app itself.** Until now the only way to say "yes, this happened" was the link in the text message or the email — so if you had deleted it, you were stuck, even while looking at the delivery on screen. There is now a button on the delivery page. It shows only the moments the transport has actually reached, and once you have confirmed one it says so, with the date, instead of offering the button again.
- **Confirming still changes nothing by itself.** It records that you agree it happened. The transporter is the one who moves the transport along, and nothing you press can advance it, take a payment or close a job — which is exactly why the link we text you is safe to send to someone with no account.
- **The transporter cannot confirm on your behalf.** They move the status; you attest it. An operator confirming for a client who cannot is recorded as the operator, never as the client.
- **You can see what kind of business a transporter is, where they have said so.** Their legal form — auto-entrepreneur, SASU, and so on — now shows on the card when they have declared one, on the *Transporteurs disponibles* tab. Where nobody declared anything, nothing is shown: an empty answer means "not stated", not "an individual", and guessing at someone's legal status would be inventing it.
- **Your receipts say where they are sent.** The invoice page now tells you each receipt is emailed to you the moment payment is taken, and that WhatsApp is not available yet — so nobody waits for a message that is not coming. Sending the document to yourself again was already possible and stays one press.

## [2.39.0] - 2026-09-10 · ux

- **The payout setup button works, and tells you when it cannot.** Pressing *Continuer la configuration* on your profile did nothing whatsoever — no message, no spinner, no error. It now shows that it is working, and when Stripe turns the request down it says so instead of leaving you pressing a button that appears broken. Stripe has currently suspended new payout accounts on our side, so that is what most people will see until we clear it with them; before today you had no way of knowing that.
- **Coming back from Stripe with an expired link now explains itself too.** That trip also ended in silence, on the same profile page, with nothing said.
- **Anyone signed in can post a transport request from anywhere in the app.** The two buttons at the top only appeared for approved drivers, so a brand-new account saw an empty bar that read as broken. Worse on a phone: the bottom bar offered the job board — which a new account cannot bid on — and no way to post a request at all. Posting is now offered to everyone with an account; the job board stays with approved drivers, who are the only people who can bid.
- **The location stamped onto pickup and delivery photos is now readable.** The band across the bottom of each photo arrived as a black bar with no letters once the app was running on its live server. The date, the place and the reference now print properly, in the same typeface the app uses everywhere else.
- **Payout setup now points at the right account.** When automatic payouts are switched on, they will reach the Stripe account a driver actually connected. Until today they would have failed for every driver, because the app looked for that account somewhere nothing had ever written it.

## [2.38.0] - 2026-09-10 · feat

- **You can now tell us something from anywhere in the app.** A new button in the top bar opens a short form — is it a bug, an idea or a comment, which screen it happened on, what happened, and up to four screenshots. It is there on every screen, on a phone as well as a computer, and it is there for everyone, not only approved drivers.
- **You can see what happened to what you sent.** A second tab lists everything you have written to us with its current status, so a report you filed is no longer something that disappears.
- **The team has somewhere to work through it.** Staff get a new Feedback screen: five counters across the top, search and filters, and the ability to set a priority, move something along, and keep private notes against it. Everyone who triages is told the moment something new arrives.

## [2.37.2] - 2026-09-10 · fix

- **The weekly image sweep can no longer empty the photo store.** It decided what to delete by asking the database which pictures are still in use, and treated anything else as rubbish — so with the platform on a fresh database it would have deleted every photo it found, at three on Sunday morning, unrecoverably. It now refuses to run when the database points at nothing, or when a single run would remove more than a fifth of what is stored.

## [2.37.1] - 2026-09-10 · fix

- **Signing in works again.** For several days nobody could get in — not with Google, not with an email and password — and every page that needs an account failed. The database the platform runs on had been removed by the service hosting it. The platform has been moved to a new one and is back.
- **Accounts have to be created again.** The old ones could not be recovered. Sign up with the same address and you are back where you were.

## [2.37.0] - 2026-09-10 · ux

- **Every screen now tells you which version you are running.** The release number sits at the left of the top bar — in the app, in the driver panel and in the admin panel — and beside the copyright line at the foot of the website.
- **Tapping it opens the release notes.** "What changed since last week?" is now one tap from wherever you already are, rather than a page you had to know existed.

## [2.36.0] - 2026-09-05 · feat

- **A transporter backing out no longer destroys the client's delivery.** Calling a job off and handing a job back were the same button, and they are opposite things: the client no longer needs the transport, or the driver cannot run it. A driver who dropped a job used to kill a paid client's delivery outright, silently, with no way back. Handing a job back now returns it to the board, restores the bids that lost to it, and the client keeps their transport.
- **The client is told which of the two happened**, rather than being told their transport is cancelled when in fact it is being re-run.
- **Drivers who lost the bid are told when a job comes back**, so a job returning to the board reaches the people who already wanted it.
- **Everyone says why, from a short list.** A van breakdown, an ill driver, cargo that was not what the job described, a pickup site nobody could reach — or, on the client's side, no longer needed, dates changed, arranged elsewhere. Cargo and access sit on the list on purpose: the driver presses the button, but the cause is the description or the site, and a future reliability score must not charge those to them.
- **Handing a job back before pickup needs nobody's approval.** A driver with a dead van at six in the morning who has to wait for someone to click approve is a job that dies during the only hours it could still be re-sold.
- **Once the goods are collected, one person can no longer end the run alone.** After pickup the goods are in a vehicle, and ending someone else's transport becomes an operator's decision.
- **An operator can now stop a run that is already on the road.** The product has claimed this since day one and has never been able to do it.
- **A cancellation always releases the client's money**, and an Expedion client who cancels from their own app has the refund owed to them recorded there rather than assumed.

## [2.35.0] - 2026-09-05 · feat

- **You can now see which transporters already drive your route, instead of waiting in silence.** A job page has a new *Transporteurs disponibles* tab listing the approved drivers whose declared trip covers your pickup and your drop-off, in that order, within the days you asked for collection.
- **One tap starts the conversation, with the opening message already written.** *Contacter* opens a thread about that job, and because the thread is attached to the job, the driver can send you a price from inside it.
- **It is a way to be found, not a second way to award.** Nothing here places a bid, moves money, or changes a job's status — an operator still chooses the winner from the offers.
- **Operators do this in the client's place on Expedion jobs**, because nobody signs in as the account those jobs belong to.
- **Drivers decide whether their trips make them findable, and no existing trip was exposed without being asked.** Every trip declared before today starts hidden; the switch is on each trip, and new ones are findable by default.

## [2.34.0] - 2026-09-05 · feat

- **You now get your receipt as soon as you pay, by email, with the PDF attached.** Until today the document was only produced once the goods had been delivered — days after your card was charged — and the email that announced it carried a link rather than the document itself.
- **You can ask for it again at any time.** Every document at *Mon profil → Factures* has a *Envoyer par e-mail* button that sends it to the address on your account. It only ever goes to your own address.
- **If a job is cancelled and you are refunded, you get an avoir.** A document that has already been issued and emailed is corrected by a second document rather than quietly changed, so your records and ours agree.
- **The documents are in French, and they say exactly what they are.** While the company's legal identifiers are still being registered, each one is a *reçu de paiement* and says so; it becomes a full *facture*, with the VAT treatment, the moment those details are filled in.
- **A test booking no longer produces a document stamped "payé".** During the current testing phase no money actually moves, and the document now says so instead of implying a debit.
- **The period filter on your invoices list works.** Choosing *Ce mois-ci* changed the bulk download but left the list showing everything.
- **The payment terms now describe what actually happens.** They still said funds were held at award and taken on delivery; you are charged when the transport is confirmed.

## [2.33.0] - 2026-09-05 · feat

- **There is now a public page listing everything that has changed on the platform.** It is at `/changelog`, linked from the footer, and it reads in French and English and in both light and dark like the rest of the site.
- **The history goes back to the first day of the transport platform.** Every one of the 69 releases since the pivot away from the goods marketplace is written up in plain language — what you can now do, or what visibly broken thing was fixed — rather than left in commit messages only a developer would read.
- **Nothing that changes the platform can ship unrecorded from now on.** A release that does not appear on this page, with a matching engineering write-up and a matching version number, now fails the build instead of shipping quietly.

## [2.32.0] - 2026-08-30 · feat

- **Search the board by the trip you are actually driving.** Name a départ and an arrivée, up to three étapes in between, and the days you can drive. The board answers with the jobs on your way and going your direction — Bordeaux to Paris offers you Angoulême to Orléans, and never the reverse.
- **Adding a stop finds work the straight line misses.** A trajet is treated as a path, not a single segment, so putting Lyon in the middle reaches jobs between the stops. Progress is measured along the whole path, so you are not offered a load that would make you double back.
- **A map, with each job's price pinned on its pickup point and your trip drawn underneath.** On a computer you see the list and the map side by side; on a phone there is a switch, placed above them rather than buried inside the half it hides.
- **Job cards now say where, precisely enough to act on.** The commune, the postcode, and the town you would know it by — "à 13 km de Clermont-Ferrand" — plus the whole collection window, "Entre le 2 sept. et le 16 sept.", where it used to print only the first day and make a fortnight look like a fixed date.
- **"Voir les courses correspondantes" actually shows them now, and a search can be shared.** The board never read its own address, so that link from a declared trip produced a search the board quietly ignored.
- **Two things that broke as you used it are fixed.** Searching with the same town at both ends failed outright instead of returning results, and typing into an étape deleted the field you were typing in, so a stop could never be filled in at all.

## [2.31.1] - 2026-08-30 · fix

- **Photos attached to an incident report are no longer deleted.** They were being filed where the weekly Sunday clean-up could not tell them apart from abandoned uploads, so every one of them would have been erased within a week — exactly the evidence a damage dispute is argued from. They are now recognised and kept.
- **Driver identity documents are stored privately again.** On the live site they were landing in the public store, reachable by anyone who guessed the address, and on the same weekly delete timer. They now go to the private store, and the system refuses to fall back to a public one. Nothing was lost: no documents, incident reports or delivery photos existed on the live site when this was found.
- **Copies of the database made for testing no longer keep what people wrote.** Incident descriptions and resolution notes, delivery confirmation notes and notes on prices offered in chat were being carried across untouched, and the check meant to catch exactly that was not looking at them. Both now cover every free-text field.

## [2.31.0] - 2026-08-30 · feat

- **Drivers photograph the pickup and the delivery, and the location is printed onto the photo itself.** Several photos per stage, each stamped with where it was taken before it is stored. A run cannot be marked collected or delivered without one, so there is always a record of what changed hands.
- **The client confirms the pickup and the delivery themselves.** From the Expedion app, or by tapping a link in the text message they already receive — no account needed. Their word is recorded separately from the driver's own update, and confirming never moves the job or the money on its own.
- **Anyone on a job can report a problem.** Damage, a delay, trouble at the door — described, with photos, and visible to the team in one queue.
- **The client pays when the transport is chosen, not on delivery.** A direct request now asks for a card as a final step when it is posted; nothing is charged at that moment, because the price is whatever the winning driver bids.
- **A driver can offer several time slots instead of one, and the award books one of them.** Someone free on the 25th or the 27th no longer has to pick one and hope it is the one the client wanted.
- **A price can be sent inside a conversation.** A button in the thread opens a short form — price, pickup date, delivery date — and it appears beside the ordinary messages. On a job that is still open it counts as a real bid, and accepting it there is the same accept as anywhere else.

## [2.30.2] - 2026-08-26 · infra

- **Nothing you can see changes** — this release is groundwork: Journal Test Fails The Build On An Unregistered Migration. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.30.1] - 2026-08-26 · ux

- **The Expedion client list reads properly, in French and in English.** Every label on that screen — the search box, the account filter, the sort options, the table headings, the page counter, and what it says when there is nothing to show or the list fails to load — is now written in both languages, so none of it falls back to a raw code name.
- **The sidebar names your access level in words.** Admin, Finance, Support, Operator, Driver or Shipper, with "Your access level" underneath, in whichever language you are using. The withdrawals and "My earnings" links are named in both languages too.

## [2.30.0] - 2026-08-26 · feat

- **You can switch the app between French and English from the header.** A FR | EN toggle now sits in the app header, in the same position and the same order as the landing page and the Expedion app, so the three surfaces behave alike.
- **Live updates reach the deployed site again.** On the live site every page was listening on the wrong channel name, so real-time updates were refused outright and never arrived. Pages now listen where they are meant to.
- **Jobs that came in through Expedion say so on the board.** The Expedion logo and wordmark now appear on the job board with a short banner explaining where the job came from, and a link out to Expedion.

## [2.29.0] - 2026-08-26 · ux

- **The sidebar now shows which access you are signed in with.** Staff access is shown prominently, ordinary access quietly, and it appears the same way in every part of the app because it comes from a single place.
- **Support and finance accounts no longer show up as "Shipper" in the admin user list.** They were being labelled with whatever role happened to come back first from the database, which is not a meaningful order.
- **Nothing flickers while you are signing in.** The badge stays blank until the session has actually arrived instead of flashing a placeholder, and its row keeps its height either way, so the menu below it does not jump.

## [2.28.0] - 2026-08-26 · feat

- **Expedion's own clients now have an admin screen of their own.** They never showed up under Users and never could: they exist only as the owners of quotes, and not one of the 4,592 of them has an account record on this side. Looking for them in the wrong place was never going to work.
- **The list is grouped one row per client and searched on the server.** Searching a delivery-note number finds the client who filed it, and the thousands of owners are paged from the server rather than downloaded into the browser.
- **A client who has genuinely signed in here shows a link to their account, and that link now lands on them.** The Users screen had been ignoring the search term it was handed, so the link opened an unfiltered list instead.
- **Every account still showed the Expeditoo badge, and that is a settings problem, not a bug.** The setting that marks an account as coming from the Expedion app is not switched on, so all 28 accounts read as Expeditoo. It does not go back and re-label old accounts by design.
- **The screen is deliberately read-only.** Quotes are still edited on the Expedion screen — a second place that could change one is how two screens come to disagree about the same row.

## [2.27.1] - 2026-08-26 · fix

- **"My earnings" was a completely blank page, and now it loads.** Two faults were stacked. The tables the screen needs had never actually been created in the live database, so every request failed — and when it failed the screen rendered nothing at all: no heading, no message, nothing to retry. The only evidence was in the browser console.
- **A failed earnings screen now says what went wrong and offers a retry.** Silence was the reason this took a developer console to diagnose.
- **Taking a job outright and requesting payment now work on the live site.** The database changes behind both had been written weeks earlier but were never applied anywhere, so the features existed in the code and not in the database.

## [2.27.0] - 2026-08-26 · feat

- **Drivers are owed 90% of the job again.** The platform takes a tenth. The rate had briefly read 100% while the split was undecided; the split is now decided.
- **A driver can ask to be paid what they have earned.** One request claims every delivery earned so far and freezes the total — there is no amount to type, because a partial request would mean choosing which deliveries it covers, and an operator approving a figure needs to know exactly which jobs that is. A delivery that lands afterwards belongs to the next request, and only one request can be open at a time.
- **The wording no longer implies the money arrives instantly.** The transfer is made outside the app by a person, so the screen says so — a driver who expects money in minutes and waits two days has been misled by the interface, not by the operator.
- **Operators get a queue for those requests, with three answers that mean three different things.** Approve says yes and moves nothing. Marking it paid records that the transfer happened and demands a reference to reconcile against. Rejecting releases the earnings back into the available balance rather than making them vanish.
- **One screen for a driver's trips — planned and completed — plus downloadable earnings statements and invoices by period.** The completed side carries the money for each job.

## [2.26.0] - 2026-08-26 · feat

- **A driver can now take a job outright at the posted price, with no bid.** The price is the one already on the job, so there is nothing to fill in — the point is that there is no negotiation. If two drivers tap at the same moment, the second is told plainly that somebody got there first, in their own language.
- **Bidding under the price is still there, and both routes sit on the job page.** Take-it-now comes first, and the option to bid lower is right beside it. Vehicles too small for the load are shown greyed out with the reason, rather than quietly hidden.
- **An operator can now take a job back off the wrong driver.** Before this, the only way to undo an award was to cancel the job, which killed it outright — the right move when the job is off, useless when the point is to let somebody else have it. The job goes back on the board and the client's money is released first, so the next award does not ring-fence a second amount.
- **Once the goods have been collected, taking the job back is refused.** A pickup is a real-world event that cannot be un-done from a screen; the honest action from that point on is to cancel and refund.

## [2.25.2] - 2026-08-26 · fix

- **Revenue figures in the admin screens now show what actually arrived.** They had been reporting a tenth of it, because every payment recorded a 90% share owed to a driver — a share the business decided not to pay out during this phase. The money itself never moved differently; only the numbers were wrong.
- **The platform keeps the whole payment for now.** That is the client's decision of 26 August, and it changes nothing about how money flows: nothing in the system had ever transferred a share to a driver automatically. A payout has only ever been a recorded line, not a transfer.
- **One published sentence is now out of date.** The terms page still says the commission is deducted and the balance paid to the carrier; at the current rate that balance is zero. The wording was left untouched on purpose — it is a legal decision, not an engineering one.

## [2.25.1] - 2026-08-26 · fix

- **The backup reader for Expedion paperwork works again.** When the main reader is unavailable the system falls back to a second one, and that fallback had been quietly failing for months because the model it asked for had been withdrawn. It now asks for a current model, and when it does fail it records why — retired, out of quota, or not switched on — instead of just going silent.
- **Client names that were filed back to front can now be repaired.** Some clients were stored with their surname in the first-name box, because a French delivery note prints "DUPONT Jean" as often as "Jean DUPONT". The original text was kept, so the correction re-reads it rather than guessing — and it deliberately leaves alone any name a person has already fixed by hand.
- **A fresh test database can now demonstrate the whole job, not just the board.** Until now the setup could show jobs being listed but nothing past that, because there was no way to produce an approved driver. Setup now creates one, with a vehicle, so bidding, winning and delivering can all be walked through.

## [2.25.0] - 2026-08-26 · feat

- **Anyone signed in can ask for a transport again.** The form for posting a delivery had been removed when Expedion escalation was the only way a job could arrive; the client asked for it back, so it is here again.
- **The form works this time.** In the version that was removed, the date fields rendered blank, clearing a number field produced an error message about zero, and the button that removes a photo submitted the whole form instead. All three are fixed, and the form now checks the same address and distance rules the server does, rather than letting you submit something that would be rejected.
- **Drivers now see every open job, not only Expedion ones.** The board was pinned to Expedion escalations and would have hidden all of these new requests. It is the board of all open jobs now, and the count on the dashboard matches what the list shows.
- **You no longer have to file your request into a category.** Somebody describing a wardrobe should not have to pick a taxonomy entry, so one is chosen for you.
- **The form speaks French.** The recovered version was entirely in English; both languages are now complete. A hidden button sitting invisibly over the photo area — left over from automated testing, and capable of adding a fake photo for anyone who found it — was removed.

## [2.24.4] - 2026-08-26 · fix

- **A client's name is now read the right way round off the slip.** French slips print "DUPONT Jean" at least as often as "M. Jean DUPONT", and the surname was landing in the first-name field for roughly half of them. The name is now read by how it is printed, and a multi-part surname like "DE LA TOUR" stays whole.
- **A company is no longer given an invented first name.** A slip made out to a business is recognised as one and kept as a single name rather than split in two.
- **A name that cannot be read with confidence is left alone.** Where the reading is uncertain nothing is written, so a name an operator corrected by hand is never overwritten by a guess — and a person's first name is never paired with a company's name.

## [2.24.3] - 2026-08-26 · fix

- **Expedion clients can attach a bordereau again.** Uploading the slip had been failing for every account created since the sign-in change, and the quote form will not submit without it — so new clients could not request a quote at all. Uploads now go to this app's own storage and the form completes.
- **Those documents are private.** A bordereau is served only to the person who uploaded it or to an administrator, through a link that expires after five minutes. Anyone else is simply told the file does not exist, so a stranger cannot even work out whether it is there.
- **Slips uploaded the old way still open.** Nothing already stored was moved, changed or deleted.

## [2.24.2] - 2026-08-26 · fix

- **Expedion clients can see their own quote history again.** Anyone signing in through the shared account system got an empty list and no error message, even though their quotes were all still there. Past quotes are now matched to the account on signup *and* on every sign-in, so an existing account finally picks them up.
- **Signing in with a Google work account no longer dead-ends.** A Google account on a domain that does not report the address as verified hit "account not linked", with no way to recover. Google is now trusted for linking those accounts together.
- **Expedion's emails look and behave like Expedion.** Verification and password-reset mail was branded EXPEDITOO and sent everyone to the driver sign-in page. It now brands and routes by the app the account was created in. The reset link itself still opens here on purpose, because this is the only app with a reset page.
- **A silent misconfiguration that once broke Google sign-in is now caught before release.** The two apps are gated by four separate approved-address lists and one of them was out of step, so the sign-in popup was refused. A check now runs on every change and nightly.

## [2.24.1] - 2026-08-23 · fix

- **An operator can once again enter a missing price on a paid quote.** Some imported quotes arrived already paid but with no price recorded, and they can never be published without one. The field for entering it was hidden on exactly those quotes, and anything typed into it was thrown away on save. It now works, and the two published figures beside it stay read-only.
- **Reopening a paid quote no longer traps it.** A quote an operator deliberately reopened could be quietly re-marked as paid behind them and land in a state with no buttons at all and no way forward. That move is now refused outright instead of half-applied.
- **"Assign a driver" no longer appears on quotes that cannot take a driver.** The menu was offering it on every blocked quote in the queue — all of them — where pressing it would only have failed. A blocked quote now shows a single Fix button and offers nothing the system would refuse.

## [2.24.0] - 2026-08-23 · feat

- **A paid quote is now a decision an operator makes, not a countdown they watch.** The row reads "Needs a driver", shows how long until the timer would publish it anyway, and offers both routes as buttons: hand the job to a driver from the pool, or publish it and let carriers bid.
- **Handing a job to a driver from the pool now actually reaches that driver.** It used to write a few fields and stop. It now produces exactly what winning an auction produces — the job, the offer, the delivery record and the payment — so both routes end in the same place.
- **The price stops being editable once the client has paid.** "Adjust price" no longer sits in the menu of a settled quote, and a background re-read of the slip can no longer rewrite it. Correcting a price that was genuinely paid goes through unwind and re-quote, which reopens the quote and shows the payment reference; no money moves here, because that payment was taken in the Expedion app.
- **Quotes were showing as due to publish hours early.** The dashboard and the automatic publisher disagreed about the same quote depending on the server's clock. They now read the same times.
- **The "needs a driver" queue was mostly jobs that did not need one.** It was listing over a thousand imported deliveries that had already been collected outside the system; it now shows the 42 genuinely waiting.
- **A client is now told who won their job.** Awarding an escalated quote hit an internal mismatch that was silently swallowed, so the award went through but the quote sat as escalated forever and the client heard nothing. The winner is recorded and shown on the timeline.

## [2.23.0] - 2026-08-22 · feat

- **Every button on the home page now leads somewhere.** Typing an offer into the demo card or pressing bid on a job row used to do nothing, or drop you on a signup form that had forgotten what you pressed. Each one now validates, confirms, and takes you to the right place — and the sign-in and signup pages tell you what you were doing when you arrive.
- **Drivers who have used this browser before are sent to sign in, not sign up.** The site remembers that an account has been used here, so coming back after signing out no longer asks you to create a second one.
- **The demo offer card checks your price properly.** It refuses anything under 50 EUR or anything that does not beat the price already on the table, shakes, explains itself and keeps what you typed instead of failing quietly.
- **All ten footer links now open a real page.** Contact, legal notice, verification and auction houses were added. The contact form sends your message to the team, and drops it into your own support conversation if you already have one.
- **Signing up as a driver no longer asks for a Kbis.** A sole trader does not have one, and the verification page already said it was not required — it asks for the SIRET now. The three example jobs on the home page are also labelled as samples, so nobody mistakes them for real work.

## [2.22.0] - 2026-08-22 · feat

- **A message sent from the Expedion app now reaches a real person and gets a reply.** The contact form used to write into a separate spreadsheet with no way back, so someone who wrote in never learned whether anyone had read it. It now opens a proper conversation in the same support inbox the website chat uses, answered the same way.
- **One person is one conversation again.** Anyone who had ever messaged a carrier got a brand-new support thread on every visit, so the support inbox showed the same person as several unrelated conversations.
- **The support inbox no longer fails on the second visit.** Once a staff member had joined a thread and read it, going back to the inbox stopped loading at all. It now opens every time.
- **Support conversations are staff-only.** Any signed-in account — a driver, for example — could read every support conversation on the platform, including other people's names, email addresses and message text. Access is now restricted to admin and support staff.

## [2.21.0] - 2026-08-22 · feat

- **The Expedion dashboard now updates itself.** A new quote, a payment, an edit by another operator, an automatic price, an escalation, or a status change coming back from a driver appears on an already-open dashboard without pressing refresh.
- **It reaches every operator, not just the one who made the change.** Checked with two sessions side by side: a quote created in one tab showed up in the other's open dashboard with no reload.
- **A dropped live connection cannot break anything.** The live update is best-effort — if the signal fails, the underlying save still goes through and the dashboard behaves as it always did, with a refresh showing the change.

## [2.20.0] - 2026-08-21 · ux

- **"To handle" now puts the newest quote at the top.** It used to rank by how urgent each type of item was and, within that, oldest first — so a request that arrived minutes ago could sit below one from days ago. It now reads newest first.
- **Every tab in the panel orders the same way.** Switching between tabs no longer reshuffles the list into a different order.

## [2.19.3] - 2026-08-21 · fix

- **Opening a quote no longer wipes the page.** Some quotes carried a photo entry the screen could not read, and simply opening one blanked the whole page with nothing left but a reload. Bad entries are now skipped and the quote opens normally.
- **An unexpected failure now shows a message and a retry button.** Anywhere in the app, a crash used to leave an empty screen with no explanation; there is now an error screen with a way to try again.

## [2.19.2] - 2026-08-20 · infra

- **Nothing you can see changes** — this release is groundwork: Tests For geocodeMissingCoordinates. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.19.1] - 2026-08-20 · fix

- **A quote is map-ready as soon as it has an address.** Quotes whose size and weight had not been filled in yet were left with no position on the map, which blocked them from being published to drivers until an operator typed the dimensions by hand. The address on its own is now enough to place both pins.
- **Correcting an address moves the pin with it.** Editing a pickup or delivery address used to leave the map still pointing at the old location; the outdated pin is now dropped straight away and replaced once the new address is looked up.

## [2.19.0] - 2026-08-20 · feat

- **A quote now reads its own paperwork the moment it arrives.** When a client submits a quote with a transport docket attached, the system extracts the details straight away instead of waiting for an operator to press a button. It only fills in boxes that are still empty, so nothing the client typed themselves gets overwritten.
- **The quote screen tells you when a reading is ready.** A pending quote now opens with a banner at the top announcing what was extracted, with a "review now" shortcut straight into editing, instead of leaving it buried further down the page.
- **The address picker shows real words again.** The postal code and city fields were printing internal placeholder labels rather than French or English text, which is what made them look like they were sitting on top of each other. Both languages are fixed.
- **The close button no longer lands on the other buttons.** The window's own close cross was overlapping the row of buttons in the quote header; it is now part of that row and cannot collide with it.
- **The quote window can be made full screen.** Editing two maps and a long form inside a small pop-up was cramped, so there is now a maximize and restore control, on desktop and on mobile.

## [2.18.1] - 2026-08-20 · infra

- **Nothing you can see changes** — this release is groundwork: Clear Two Exhaustive-Deps Warnings In QuoteDetailDialog. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.18.0] - 2026-08-20 · feat

- **A quote that cannot be published can now be fixed on the page instead of in the database.** Rows missing coordinates, an address, a weight or an agreed price used to show a greyed-out Publish button with no way to find out what was wrong. Publish now opens the quote in edit mode with a live checklist of exactly what is still missing, a map for placing the pickup and delivery points, and a field for the agreed price.
- **Correcting a quote no longer clears its weight and size.** Saving the quote form was writing back an empty weight, length, width and height even when those fields were never touched.
- **The data-quality counters are clickable.** The tiles counting quotes with missing coordinates or missing dimensions now jump straight to the list of those quotes instead of just stating the number.
- **Storage terms can finally be edited.** The storage queue has a dialog for extending a free period or changing the daily fee — the change was always accepted behind the scenes, there was simply no screen for it.

## [2.17.0] - 2026-08-20 · feat

- **A client waiting on a quote can now be shown an AI price estimate while it is still being priced.** The same analysis an operator sees when repricing — a standard price, an insured price, and the reasoning behind them — is now available to the Expedion app. It is worked out once and remembered, so reopening the screen does not recompute it, and it stops being offered once the quote has a real price.
- **Correcting a quote throws away a stale estimate.** Changing weight, dimensions or either postal code clears the old AI figure rather than leaving a number on screen that was based on the values you just changed.
- **An operator can now correct a quote's details in the page.** The quote panel was read-only; it now has an edit mode covering the client's identity and address, the pickup, the delivery and the cargo, saved through the audited staff route rather than the client's own confirm-details screen — which an imported quote with no client account could never reach.
- **Staff can re-read a quote's uploaded document.** For a client who uploaded a bordereau but never finished confirming the details, an operator can run the analysis again over the stored document. It only fills in blanks — anything already corrected by hand is left alone.
- **Admin lists can be filtered by date range.** Today, yesterday, the last 7 or 30 days, this month, or a range you pick yourself — on carrier applications, deliveries, listings and users. The button says which range you are on rather than showing two raw dates.

## [2.16.1] - 2026-08-20 · fix

- **Large euro amounts are readable again.** The separator between thousands was a very thin space that many fonts render as nothing at all, so an amount printed as one unbroken run of digits and was easy to misread by a factor of a thousand. Amounts now print with a visible dot — 189.543,65 €.
- **Every amount is now formatted the same way.** The dashboards, the award queue, payments, the job and bid cards, the invoices and the text message the client receives all print money identically, so the same number cannot look different depending on which screen you are on.

## [2.16.0] - 2026-08-20 · ux

- **The newest admin screens now read properly in both French and English.** The "log in as" and account-moderation dialogs, the "all statuses" filter on carrier applications, and the new recent-quotes worklist — its tabs, its next-step badges and its document-preview labels — all have real wording in both languages.
- **Both languages carry exactly the same set of texts.** Checked entry by entry rather than by eye — 1,340 on each side, with nothing present in one language and missing in the other.

## [2.15.1] - 2026-08-20 · fix

- **The EXPEDITOO logo now keeps the same proportions everywhere it appears.** The symbol and the wordmark beside it were sized independently, so the same lockup read as a noticeably different shape on the mobile header than in the landing page's navigation bar. Every part of it — text sizes, spacing, corner rounding — now scales together from one size.

## [2.15.0] - 2026-08-20 · feat

- **The operator dashboard no longer hangs while loading.** It used to ask the database for eighteen things at once, and once that ran past what the connection could serve, the page sat there loading for ever instead of failing. It now loads in three smaller waves, and a figure that fails costs you that one card rather than the whole page.
- **Recent quotes is now a worklist, and it sits at the top of the page.** Switch between the ones still waiting on someone and all of them, most urgent first. Every row that is waiting says what it is waiting for and carries the button that does it — Set price, Assign, or Publish — so the label and the button can never disagree.
- **Opening a quote now shows the client's contact details and their documents.** The bordereau and the photos the client uploaded preview inside the panel instead of being a link you have to open somewhere else.
- **The sidebar and the mobile menu carry counts.** Red where work is waiting on staff, grey for volume, refreshed about once a minute — so you can see what needs attention without opening each page to check.

## [2.14.1] - 2026-08-20 · ux

- **Opening driver applications now shows every one waiting for review.** The page used to open on a single status, so an application in any other state was invisible unless you already knew to go and widen the filter.
- **The newest applications are at the top.** Now that the page opens on the full queue rather than a short slice, it is ordered newest first.
- **The status filter works exactly as before.** Every status is still there to narrow down to — it is simply no longer applied for you, with "All statuses" as the starting point.

## [2.14.0] - 2026-08-20 · feat

- **An admin can now log in as another user to see exactly what they see.** The borrowed session lasts an hour, shows a banner the whole time it is active, and is recorded so it is always clear who looked at what and when.
- **Suspending an account finally does something, and cutting off access takes minutes instead of a week.** Marking someone as suspended used to change nothing at all — they could still sign in as normal; it now blocks new sign-ins and ends the sessions they already have, and a sign-out or suspension takes effect within about five minutes rather than going unnoticed for up to seven days.
- **More can be done from the user list.** You can see when someone last signed in, open their profile, send them a password reset, sign them out everywhere, or delete the account — and when an action is not allowed, the menu tells you why instead of quietly hiding the option.
- **Looking at someone's account never changes it.** While an admin is viewing as another person, nothing is written on that person's behalf: their messages are not marked as read and no payment details are set up in their name.
- **A suspended or unverified account is still viewable by the admin who needs to see it**, rather than being locked away from the one person trying to sort it out.
- **The user list can now tell an EXPEDITOO signup from an Expedion one** — but only for accounts created from now on, because nothing in the records says where an older account came from and guessing would have been wrong more often than right.

## [2.13.6] - 2026-08-20 · infra

- **Nothing you can see changes** — this release is groundwork: APP_ENV, Fail-Closed DB Guards And An Anonymised Mirror. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.13.5] - 2026-08-19 · fix

- **A price an operator publishes can now actually be accepted.** The client was shown the price and then got an error the moment they tried to accept it. Publishing the price now moves the quote to the stage where accepting is allowed.
- **A priced quote no longer disappears from every queue.** It used to drop off the "to price" list without arriving anywhere else, so nobody on the team was watching it any more.
- **Correcting the price on a job that is already accepted or paid does not send it backwards.** The stage only moves forward from the two points where that makes sense.

## [2.13.4] - 2026-08-19 · fix

- **Being granted admin now actually gives you the admin dashboard.** An account could be given admin access and still see no admin link anywhere — the app was failing to load that person's permissions at all and treating them as having none.
- **Leftover access labels from the old version no longer wipe out real ones.** A few accounts still carried labels that stopped meaning anything when the marketplace was retired, and a single one of those was enough to hide every genuine permission the person held.
- **Ten accounts have been tidied up.** The dead labels were removed; they granted nothing, and anyone left with none falls back to the ordinary default.

## [2.13.3] - 2026-08-16 · infra

- **Screens that were failing outright now load again.** The job board, deliveries, the award queue and the admin money screens were all returning an error because the database still held the shape of the old marketplace version while the app expected the new one. An earlier attempt to bring it up to date had stopped on the first bad value and undone itself completely, so nothing was left half-changed — it simply had not happened yet.
- **Nothing was lost on the Expedion side.** All 4,592 quotes came through intact, along with every account, bid, driver profile, vehicle and conversation.
- **The last leftovers of the old marketplace version are gone.** A handful of stale jobs, shipments and payments from the previous product were cleared out, along with seven leftover pieces of the database nothing uses any more.

## [2.13.2] - 2026-08-16 · fix

- **Signing in on the live site works again.** The site had started turning away sign-in attempts that came from its own web address, showing an "Invalid origin" message that looked like a crash, and the Google button failed before it ever reached Google.
- **The address people actually use is now trusted automatically.** Whichever address a deployment is served on — the live one or a temporary test one — sign-in works there, without anyone having to remember to update a setting first.
- **Google sign-in on a brand-new address still needs one manual step from the team.** Until the new address is registered on both sides, the Google button will not work there; ordinary email sign-in is unaffected.

## [2.13.1] - 2026-08-16 · fix

- **Six screens that only showed an error now work.** Deliveries, the award queue and the admin lists of jobs, shipments and payments were all failing outright. The stored data was still shaped for the old goods-auction product, so anything that looked up a transport job broke.
- **Nothing anyone depends on was lost.** Accounts, roles, offers, drivers, vehicles and all 4,591 imported Expedion quotes are untouched. The only records removed were 31 old auction listings and a handful of related rows from the retired product, none of which was attached to a transport job.
- **Four dead pages removed.** An empty "reports" placeholder, a public profile page, an FAQ and a startup splash screen had no link pointing at them from anywhere in the app.

## [2.13.0] - 2026-08-16 · feat

- **Expeditoo is the driver's app now.** The screens for posting a transport job yourself are gone — the four-step job form, its confirmation page and the "my jobs" list. Work arrives from Expedion instead, and the old "my jobs" link takes you to the new job board.
- **The home screen is a driver dashboard.** It shows where your application stands, the run you are currently on, the jobs open for bids and the bids of yours still waiting on a decision.
- **A job board that shows only Expedion work.** The board moved to its own page and is pinned to jobs that came from Expedion, so nothing else clutters it — and it reads in French or English now, having been English-only before.
- **An operator awards escalated jobs, from one queue.** Those jobs belong to Expedion rather than to a person who could sign in and choose, so an operator or administrator picks the winner — from the job page or from a new award queue. The client who paid is the one charged, never the operator who clicked.
- **Applying as a driver no longer asks for a company registration document.** A sole trader does not have one. A SIRET number and one vehicle are still required, the vehicle because your offer has to name the one that will do the job.
- **Granting a role in the admin panel works.** Carrier, driver, shipper, support and finance were all refused as invalid, and the one option the form did accept then failed when it was saved. All of them can be granted now.

## [2.12.0] - 2026-08-16 · feat

- **One operator screen for the whole platform.** The Expedion admin page and the old admin dashboard are now a single page: six headline figures, the quote funnel, and cards on supply and data health — all fed from one place, so no two numbers on the page can disagree with each other.
- **Four work queues you can clear without leaving the page.** Quotes to price, quotes with no driver, storage at risk and escalation due, with repricing, assigning a driver and escalating to the marketplace all done on the row itself instead of one round trip through a detail page per quote.
- **Escalating a quote asks you to confirm, and refuses when it cannot work.** Escalation cannot be undone, so it sits behind a confirmation, and the button is switched off outright when the pickup location has no coordinates — the exact thing that would have made the escalation fail anyway.
- **The operator screen speaks your language.** It could only ever appear in French, whatever language the rest of the app was set to. It is now complete in French and English.
- **Money on this page is labelled provisional, because it is.** Payments still run in test mode and payouts never leave "scheduled", so the figures are indicators rather than accounts.
- **Old links still land somewhere useful.** The previous admin dashboard, and the five links pointing at it, now bring you here.

## [2.11.1] - 2026-08-16 · fix

- **"Mes devis" no longer shows every customer's quotes to an operator.** An account holding operator rights that opened its own quote list in the Expedion app got the entire table back — 4,591 quotes belonging to everyone — with the counters totalling the whole platform and the bordereau box searching across other people's customers. It returns only that person's own quotes now.
- **"Mes paiements" no longer reports company-wide revenue as one person's earnings.** For an operator it had been totalling the whole platform's money as though it were their own.
- **Seeing everything is now something you have to ask for.** A wide view of all quotes must be requested explicitly and requires administrator rights; a caller who asks for it without them is told no, instead of quietly being handed only their own rows and left believing they saw everything.
- **Nothing needs updating in the Expedion app.** The whole fix is on this side — the app never sent a user id in the first place, only its sign-in.

## [2.11.0] - 2026-08-14 · ux

- **The app now opens in your phone's theme.** It always started in light mode before, whatever the device was set to. It follows the device now, and a theme you pick yourself still overrides that.
- **The app now opens in your device's language.** Anyone who had never chosen a language got French. An English device gets English, and French remains what a device asking for a language the app does not ship falls back to.
- **The theme setting no longer shows the wrong option ticked for a moment as the app starts.** Before the page finished loading, the switch briefly marked "light" as your choice even when it was not.

## [2.10.3] - 2026-08-14 · infra

- **New versions of the app can be released again.** Every attempt to publish an update was being rejected before it started, on every account tried, because the plan the app runs on does not allow automatic background work more than once a day — and the app needs four such jobs. That work now runs elsewhere and updates go out normally.
- **The automatic background work keeps its old timetable.** Expired jobs are still swept every 15 minutes, paid Expedion quotes are still checked for escalation every 10 minutes, driver document expiry runs once a day and the image cleanup once a week.
- **A background run that fails is not repeated automatically.** These jobs send emails and change payment-related records, so a half-finished run is never replayed — it is left failed, visibly, and the next scheduled run picks the work up.

## [2.10.2] - 2026-08-14 · fix

- **Your own sign-in is now what proves who you are on the Expedion quote screens.** The app used to present a shared secret alongside a claimed customer id, and anyone holding that secret could ask for anyone's quotes. The signed-in account is checked first now, and nothing about who you are is taken from the app's own word.
- **Operator access follows the role on your account, not the secret you present.** Whether a caller counts as an administrator is decided by the same admin role the rest of the app reads, instead of being inferred from which key came with the request.
- **The older Expedion app keeps working unchanged.** Callers with no sign-in — the previous version of the client, and the automatic background jobs that talk to us directly — still go through the shared key, so nothing had to be updated on their side.

## [2.10.1] - 2026-08-14 · fix

- **A driver can now start the job they won.** Winning an offer created the delivery but left it stuck: there was no button anywhere to begin it, and the winning carrier was thrown out of the driver area entirely. Approved carriers are now set up to drive their own jobs, jobs waiting to start show up in the driver's list, and a "Start job" action moves them along.
- **Password reset works again.** Asking to reset your password sent the account-verification email instead, and the link in it could not complete the reset. Reset now has its own message and its own link.
- **Delivery progress is readable again.** The highlighted step in the delivery timeline was white on white, so you could not tell how far along a job was. The same invisible colours affected badges in fourteen places across the app.
- **Drivers no longer see what is none of their business.** A driver opening a delivery was being sent the client's email address, payment references and the job's budget. Only what is needed to do the run is sent now.
- **Dead ends in the menus are fixed.** The driver menu pointed at a screen drivers are not allowed to open, one sign-in link led to a missing page, and "My jobs" had no way in.

## [2.10.0] - 2026-08-14 · feat

- **Signing up with an email address works again.** Every email signup used to fail before the verification message was even sent, because the account was being given a role the system no longer recognises. New accounts now get a valid role, and a problem assigning it can no longer swallow the verification email.
- **Drivers can finally place a bid from the app.** The bid form was fully built but was not shown on any screen, so there was no way to make an offer through the interface. It is now on the job page.
- **Carriers can apply and manage their vehicles on screen, and staff can review those applications.** The application form, the document checklist, the bank details and the vehicle list existed only behind the scenes with no page to reach them; the review side was pointed at an address that never existed and now reads the real applications.
- **Deliveries, the driver area and "My jobs" stopped being dead ends.** The first two were left over from the previous version of the product and broke on real data, and saving a draft already sent you to a "My jobs" page that did not exist. All three now work against how deliveries actually run.
- **The money side runs end to end for testing — with fake money.** Accepting an offer used to reserve nothing, so nothing could be charged on delivery and no payout ever ran. For the test period it now completes with stand-in payments and the real 10% commission. No real card is charged.
- **The public website was rebuilt around transport.** The out-of-date pricing page is gone, and the app's French and English text is back in step at 1,283 phrases each.

## [2.9.1] - 2026-08-13 · infra

- **Nothing you can see changes** — this release is groundwork: CLAUDE.md Header No Longer Contradicts Its Own Status Section. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.9.0] - 2026-08-13 · ux

- **The bottom bar now matches what you actually do.** Drivers and carriers get the job board, their offers and their deliveries. People posting jobs keep the post button. One bar could not serve both, and the compromise version buried the driver's work.
- **If you both post and drive, you get the driver bar.** That is the side with time-sensitive work on it — a bidding window that closes, a run to start — so it wins the tie.
- **The new labels are in French and English.** Both languages were checked key by key, not by eye.

## [2.8.0] - 2026-08-13 · feat

- **The board now reads like a list of jobs instead of a shop.** Each card leads with where the load goes, how heavy it is, when it moves and what it pays — the four things a driver actually decides on. The long description no longer appears on the card at all.
- **Jobs about to close are marked.** Anything whose bidding window shuts within six hours is flagged, so a job is not lost simply because the deadline passed unnoticed.
- **You can see at a glance which jobs you have already bid on.** They are marked on the board, so it reads as your worklist rather than a catalogue you have to remember your way around.
- **Filters ask the questions a driver asks.** Filter by what it pays, by the kind of load, and by weight framed as what your vehicle can carry. Searching no longer wipes the screen — typing keeps the current results visible instead of collapsing to a spinner on every keystroke.
- **The map keeps up with the board.** Pins now sit on each job's collection point and the view frames itself around the jobs currently listed, without re-zooming every time the list refreshes.

## [2.7.0] - 2026-08-13 · feat

- **Jobs are now sorted by what is being moved, not what is being sold.** The choices are furniture and moving, appliances, pallets and freight, construction materials, vehicles, machinery and equipment, fragile items and artwork, documents and parcels, refrigerated, bulk goods, animals, and other. Whoever posts a job picks one, and drivers can filter the board by it.
- **The old shopping checkout is gone.** There is no basket and nothing to buy here — the money is arranged when an offer is accepted and taken on delivery, so the three checkout screens served no purpose and have been removed.
- **Payment reminders now take you to the delivery.** The pending-payments panel and the payment email used to lead to the checkout screen; they now open the delivery the payment belongs to, so the link no longer leads nowhere.

## [2.6.4] - 2026-08-13 · infra

- **Nothing you can see changes** — this release is groundwork: Transport-Only Refinement Plan And Pivot Residue Audit. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.6.3] - 2026-08-13 · fix

- **A completed delivery no longer sits with its money unaccounted for.** Marking a job delivered now takes the payment that was being held and records what the driver is owed, in the same moment.
- **Cancelling a job that was never delivered now lets go of the money held on the client's card**, instead of trying to give back a charge that never actually went through.
- **A client who came in through Expedion now sees the delivery move without leaving their app.** Being handed to a driver, every status change, proof of delivery and cancellation are all reported back — before this, the link existed but nothing was ever sent down it, so "retrait en cours" never appeared on their side.
- **A brief payment outage can no longer stop a delivery from being recorded as delivered.** The goods genuinely arrived; the money is retried separately.

## [2.6.2] - 2026-08-13 · infra

- **Nothing you can see changes** — this release is groundwork: Listings Spec Tests, With The Bidding-Window Edges Pinned. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.6.1] - 2026-08-13 · infra

- **A job whose bidding window has passed now closes by itself.** It used to stay open and keep taking bids that could never be accepted; now it closes, the pending bids are marked expired, and the client is told. Nobody's money is touched — nothing was ever held on a job that was never awarded.
- **Drivers are warned 30 days before a licence or insurance certificate runs out.** If a required document does lapse, the account is suspended until it is renewed, so you find out ahead of time rather than at the moment you try to bid.
- **The automatic background jobs can no longer be set off by a stranger who guesses the web address.** If the shared password for them is missing, the request is turned away outright instead of being let through.

## [2.6.0] - 2026-08-13 · feat

- **Drivers get their first screen: a list of every bid they have placed.** Each one shows its state — pending, accepted, rejected, withdrawn or expired — and a bid still pending can be pulled back.
- **The bid form and the driver-application calls are built but no screen opens them yet.** Everything below is how they behave once something links to them.
- **A van that is too small for the load is shown greyed out rather than hidden.** A driver who cannot find their own vehicle assumes the form is broken; now they can see why it is not selectable.
- **Bidding above the client's budget is allowed — you get a warning, not a wall.** The budget is what the client expects to pay, and drivers routinely bid over it.
- **Identity and licence documents never travel by the public upload path.** They are sent straight to the server with the request and read back only through a link that expires.
- **Refusals say what went wrong in words you can act on:** not approved yet, you already bid on this job, that vehicle is too small, that pickup time is outside the job's window.

## [2.5.1] - 2026-08-13 · infra

- **Nothing you can see changes** — this release is groundwork: Spec Tests For The Offers Engine And Carrier Onboarding. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.5.0] - 2026-08-13 · feat

- **When an offer is accepted, the client's card is held so the driver can see the job is funded.** The money itself only moves once the goods are delivered.
- **Drivers who lose a bid are now told they lost, in the app.** Bidding into silence while holding capacity open was the worst thing that could happen to a driver; the winner is told too.
- **A completed job now pays one person: the driver.** The old money split a single order between a seller and a driver, which no longer matches how a transport job works. It is now one payment to the driver of the price less the platform's share, taken at source.
- **Prices were defaulting to Indonesian rupiah on a France-only product.** Money is now recorded in euros.
- **The French and English text is complete again.** English was missing 3 phrases and French 57, and the leftover wording from the old auction product has been taken out of both.

## [2.4.0] - 2026-08-13 · feat

- **Posting a transport job is now a four-step form: what, where, when, and budget.** Each step is checked on its own, so you are never stopped by a field on a screen you have not reached yet.
- **An apartment address now has to say which floor it is on and whether there is a lift.** Both change how hard the job actually is, and a driver prices against them.
- **The budget field now says plainly that it is what you expect to pay, not a limit.** Drivers can and do bid above it, and a bid over budget is shown as a normal offer with the difference spelled out rather than flagged as a mistake.
- **The job page shows the competing offers side by side.** Each bid is shown against the budget and the lowest one is marked, but nothing is picked automatically — a person still chooses the winner. You only ever see the offers you are entitled to see; the ones you may not see are never sent to your device at all.
- **The leftover screens from the old goods marketplace are gone.** The automatic price suggestion, the purchase-slip upload and the seller profile page have been removed rather than left to rot.
- **Two refusals now come back as something you can act on** instead of a raw code: the job has just been awarded to someone else, or you need to add a payment method before you can accept an offer.

## [2.3.0] - 2026-08-13 · feat

- **Applying to drive is now a proper, savable process.** You can keep a draft, submit it, withdraw it, add your banking details, upload your documents and manage your vehicles — and an admin reviews the queue and approves, rejects or suspends.
- **Your identity documents can no longer be opened by anyone holding the link.** They are stored privately and opened through a link that lasts five minutes, issued only after we have checked who is asking.
- **Reviews are now about a delivery, not a listing.** Only the two people involved in a delivery can review it, only once each, and only once it has actually been delivered.
- **Admin figures now measure transport.** Total value is what has actually been delivered, and platform revenue is the commission taken on payments — no longer leftovers from the old goods marketplace.
- **A miscounted review list is fixed.** When reviews were filtered, the page said how many reviews there were in total instead of how many matched the filter.

## [2.2.0] - 2026-08-13 · feat

- **Applying to drive tells you everything that is missing, all at once.** The application is checked in a single pass, so you see the whole list of gaps instead of fixing one thing, resubmitting, and being told about the next one.
- **A mistyped SIRET, IBAN, BIC, number plate or phone number is caught immediately.** These checks catch typing mistakes, not unregistered businesses — a human reviewer still confirms the company actually exists.
- **Your full bank details are never kept here.** The IBAN and BIC are checked, then cut down to the last 4 characters before anything is saved; the full value stays with the payment provider.
- **Drivers never see prices, offers or payouts.** Commercial figures are removed before a delivery is sent to a driver's device, rather than merely hidden on the screen.
- **Upload the auction-house slip and the details are read off it for you.** You confirm what was read on a review screen before the quote is priced, so nothing is filled in behind your back.
- **A paid job nobody picks up now reaches drivers here automatically.** When no driver takes a paid Expedion job in time it becomes an open job on this app, drivers bid on it, and the client stays in their own app — with a text message when the quote is ready, when a driver is assigned, and when the delivery moves.

## [2.1.1] - 2026-08-13 · infra

- **Nothing you can see changes** — this release is groundwork: CLAUDE.md Rewritten For The v2.0 Transport Product. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.1.0] - 2026-08-13 · feat

- **Carriers can now bid on a transport job.** A carrier submits an offer with their price and the vehicle that will do the run, can withdraw it, and can see their own offers in one place.
- **Two people can never win the same job.** If a job is accepted twice at the same instant, exactly one offer wins — the other attempt is turned away instead of creating a second delivery.
- **A failed card no longer strands a job half-awarded.** If the payment authorisation fails after an offer is accepted, the job goes straight back on the marketplace with every bid still on it.
- **Pressing accept twice on the winner is harmless.** It simply gives you back the delivery that already exists, rather than starting a second one.
- **A carrier sees only their own bid.** Everyone else sees how many offers there are and the lowest price; only the person who posted the job sees them all — and that is enforced by the system, not just hidden on screen.

## [2.0.2] - 2026-08-13 · infra

- **Buying and selling goods is gone.** The auction pages, "My auctions", "My bids" and the winner's checkout have all been removed. This app is now only about moving things, not selling them.
- **A listing is now a transport job.** Instead of an item with a price, a job says what is being moved, where it is collected and delivered, when it needs to happen, and what the client has already paid.
- **Carriers make offers, not bids.** An offer is a competing quote on a job, and it names the vehicle that will actually do the work. You can hold one live offer per job — withdraw it and you are free to offer again.
- **A driver's profile can now hold more than one vehicle.** The old profile could only ever describe a single one, which made it impossible to say which of your vehicles a given job would use.
- **Money is counted in euros.** New payments had been defaulting to Indonesian rupiah, which is plainly wrong for a France-only service.

## [2.0.1] - 2026-08-13 · infra

- **Nothing you can see changes** — this release is groundwork: SDD Plan And Four Specs For Phase A Bidding Core. What it was for is recorded in [STATUS.md](./STATUS.md).

## [2.0.0] - 2026-08-13 · infra

- **The app is now EXPEDITOO, and it no longer calls itself an auction site.** The word "Auctions" is gone from the app title, from the name on your home screen when you install it, and from the shortcuts — because selling goods is no longer what this is for.
- **The old goods marketplace is still here for now.** This is the last full snapshot before it is taken out and replaced by transport jobs and driver bidding, kept deliberately so there is something to fall back to.
