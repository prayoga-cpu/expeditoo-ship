# Requester message alert — spec

Status: **current** (2.84.0). From the client's 2026-11-14 feedback: « Should
receive an email when a driver sends a message. »

## 1. What was wrong

Not a bug — a direction nobody built. `driverAlertsService.onNewMessage`
(client_feedback_2026_10_29_spec.md §N7) fires only when the **requester**
writes to a driver, and its own comment says a driver writing to the requester
« alerts nobody ». A requester learned of a reply only by opening Messages.

## 2. Behaviour

`requesterAlertsService.onDriverMessage` (`requester-alerts.service.ts`) sends
the requester **one email** when a driver writes to them about their job.

It answers `skippedReason` and sends nothing when:

| Reason | Case |
|---|---|
| `NO_RECIPIENT` | the message has no recipient |
| `NO_JOB` | a thread with no job (support) |
| `NOT_A_DIRECT_REQUEST` | an escalated job — its owner is the system account nobody reads |
| `FROM_REQUESTER` | the requester is the sender |
| `NOT_TO_REQUESTER` | the recipient is not the job's requester |
| `NOT_A_DRIVER` | the sender has no carrier profile |
| `RECENTLY_ALERTED` | the same sender wrote in this thread < 30 min earlier (`MESSAGE_ALERT_QUIET_MS`, shared with the driver's alert) — a burst is one email |
| `NO_EMAIL` | the requester has no address |

The email (`RequesterMessageEmail`, French) names the job and links to
`/messages/<conversation>`. **It never carries the driver's words**, as the
driver's alerts never carry the client's.

## 3. Where it fires

- `messagesService.sendMessage` — every ordinary message.
- `threadOffersService.submit` — a quote typed in the chat is a message too.
- **Not** `announceBid`: a quote sent from the job page already raises its own
  « offer received » notification, so mailing it again would be two for one.

Best-effort throughout: `void …catch(console.error)`, so a failed email never
fails the message.

## 4. Deliberately not built

- **No SMS.** The requester's phone lives in `user_contact_details` (owner and
  staff only); a text per message would be a flood.
- **No opt-out switch.** `emailNotificationPreferencesSchema` has no
  `messages` key and the driver's alerts have none either; a toggle is a
  schema, a default migration and a settings row. The 30-minute window is the
  throttle for now.

## 5. Test coverage required

`requester-alerts.service.test.ts` (each row of §2, the quiet window both
sides, no message text in the mail), `messages.service.test.ts` (the hook is
called with the pair), and the existing `thread-offers.service.test.ts` stays
green with the alert stubbed.
