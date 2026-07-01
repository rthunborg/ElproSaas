# auto-bmad epic report log — epic-3

## Report — 2026-07-01T12:42:52Z (final)

**Epic:** `3` — 5 stories.
**Branch:** `epic/3-crm-company-settings-and-pricing-foundation` (HEAD `a896b04`).
**Pipeline status:** Clean completion. All 5 stories implemented, thin-reviewed, and landed; epic trace gate PASS (100% P0/P1 coverage); Tier-B integration review converged CLEAN over 2 iterations (1 HIGH + 3 lower Patches fixed + verified). Normal (non-draft) PR.
**Continues:** (none - single epic run; spanned several tool restarts, all work committed per phase)

**Summary:** Epic 3 (CRM, Company Settings, And Pricing Foundation) delivered the tenant-owned inputs to start quote-producing work: CRM customers/facilities/contacts (data model + envelope commands + RLS + audit), the CRM tenant-admin UI, company identity / quote-terms / VAT defaults with a structural owner/legal sign-off, work-roles + optional manual articles in integer ore, and a pure snapshot-source contract that freezes those settings/pricing inputs for later quote versions. No money/VAT/ROT calculation engine (Epic 4) and no quote-version persistence (Epic 6) - foundation only.

**Timing:** started 2026-06-30T10:50:17Z; completed in progress — elapsed 25h 52m (≈55m AI-run, ≈24h 57m human/idle wait).

**Stories:**
1. 3
2. -
3. 1
4. t
5. e
6. n
7. a
8. n
9. t
10. -
11. o
12. w
13. n
14. e
15. d
16. C
17. R
18. M
19. d
20. a
21. t
22. a
23. m
24. o
25. d
26. e
27. l
28. +
29. c
30. o
31. m
32. m
33. a
34. n
35. d
36. s
37. -
38. d
39. o
40. n
41. e
42. (
43. T
44. i
45. e
46. r
47. -
48. A
49. :
50. 1
51. M
52. e
53. d
54. f
55. i
56. x
57. e
58. d
59. ,
60. 1
61. L
62. o
63. w
64. d
65. e
66. f
67. e
68. r
69. r
70. e
71. d
72. ,
73. s
74. e
75. c
76. u
77. r
78. i
79. t
80. y
81. c
82. l
83. e
84. a
85. n
86. )
87. .
88. 3
89. -
90. 2
91. C
92. R
93. M
94. t
95. e
96. n
97. a
98. n
99. t
100. -
101. a
102. d
103. m
104. i
105. n
106. U
107. X
108. +
109. l
110. i
111. f
112. e
113. c
114. y
115. c
116. l
117. e
118. -
119. d
120. o
121. n
122. e
123. (
124. T
125. i
126. e
127. r
128. -
129. A
130. :
131. 2
132. M
133. e
134. d
135. d
136. e
137. c
138. i
139. s
140. i
141. o
142. n
143. s
144. a
145. u
146. t
147. o
148. -
149. d
150. i
151. s
152. m
153. i
154. s
155. s
156. e
157. d
158. ,
159. 2
160. L
161. o
162. w
163. d
164. e
165. f
166. e
167. r
168. r
169. e
170. d
171. ,
172. s
173. e
174. c
175. u
176. r
177. i
178. t
179. y
180. c
181. l
182. e
183. a
184. n
185. )
186. .
187. 3
188. -
189. 3
190. c
191. o
192. m
193. p
194. a
195. n
196. y
197. i
198. d
199. e
200. n
201. t
202. i
203. t
204. y
205. /
206. q
207. u
208. o
209. t
210. e
211. t
212. e
213. r
214. m
215. s
216. /
217. V
218. A
219. T
220. d
221. e
222. f
223. a
224. u
225. l
226. t
227. s
228. +
229. s
230. i
231. g
232. n
233. -
234. o
235. f
236. f
237. -
238. d
239. o
240. n
241. e
242. (
243. T
244. i
245. e
246. r
247. -
248. A
249. :
250. 1
251. M
252. e
253. d
254. f
255. i
256. x
257. e
258. d
259. ,
260. 2
261. d
262. e
263. c
264. i
265. s
266. i
267. o
268. n
269. s
270. a
271. u
272. t
273. o
274. -
275. d
276. e
277. f
278. e
279. r
280. r
281. e
282. d
283. ,
284. s
285. e
286. c
287. u
288. r
289. i
290. t
291. y
292. 0
293. /
294. 0
295. /
296. 1
297. )
298. .
299. 3
300. -
301. 4
302. w
303. o
304. r
305. k
306. r
307. o
308. l
309. e
310. s
311. +
312. o
313. p
314. t
315. i
316. o
317. n
318. a
319. l
320. m
321. a
322. n
323. u
324. a
325. l
326. a
327. r
328. t
329. i
330. c
331. l
332. e
333. s
334. (
335. i
336. n
337. t
338. e
339. g
340. e
341. r
342. o
343. r
344. e
345. )
346. -
347. d
348. o
349. n
350. e
351. (
352. T
353. i
354. e
355. r
356. -
357. A
358. :
359. A
360. p
361. p
362. r
363. o
364. v
365. e
366. ,
367. 1
368. L
369. o
370. w
371. d
372. e
373. c
374. i
375. s
376. i
377. o
378. n
379. +
380. 1
381. L
382. o
383. w
384. d
385. e
386. f
387. e
388. r
389. r
390. e
391. d
392. ,
393. s
394. e
395. c
396. u
397. r
398. i
399. t
400. y
401. c
402. l
403. e
404. a
405. n
406. )
407. .
408. 3
409. -
410. 5
411. s
412. n
413. a
414. p
415. s
416. h
417. o
418. t
419. -
420. s
421. o
422. u
423. r
424. c
425. e
426. c
427. o
428. n
429. t
430. r
431. a
432. c
433. t
434. -
435. d
436. o
437. n
438. e
439. (
440. T
441. i
442. e
443. r
444. -
445. A
446. :
447. A
448. p
449. p
450. r
451. o
452. v
453. e
454. ,
455. 3
456. i
457. n
458. f
459. o
460. r
461. m
462. a
463. t
464. i
465. o
466. n
467. a
468. l
469. L
470. o
471. w
472. d
473. i
474. s
475. m
476. i
477. s
478. s
479. e
480. d
481. ,
482. s
483. e
484. c
485. u
486. r
487. i
488. t
489. y
490. c
491. l
492. e
493. a
494. n
495. )
496. .

**Skipped (already done):** none

**Integration review:** Tier-B (2 iterations, converged clean, convergence_unverified=false -> normal PR). Roster: per-story blind+edge (5 chunks) + 2 cross-story integration auditors (diverse models) + cross-story security. Iter 1: ~145 raw -> 9 kept (1 High, 4 Med, 4 Low), 34 dismissed. Fixed: HIGH work-role/article REACTIVATE AC gap (archive was a one-way, invisible door - the per-story thin review under-rated it on a false premise; the integration view caught it), MED logo_url wiped to NULL on every settings save (data loss), MED pricing archive failures silently swallowed, LOW snapshot VatDisplayMode type. Iter 2 (fix re-review): auditor APPROVE + security clean (reactivate no IDOR; include-archived no cross-tenant leak); 5 Low residuals deferred. 8 [Review][Decision] items auto-resolved (all Med/Low - none forced a draft).

**Epic gate:** Trace PASS (P0/P1/overall 100%, 36/36 requirements FULL, all 8 score-6 risks R-001..R-008 mitigated, 11/11 non-negotiable exit criteria met). NFR PASS (advisory) - 6 PASS / 2 CONCERNS (no pnpm-audit CI gate + no coverage reporter, carried across epics 2 AND 3). Test-review 92/100 (A) - Determinism 97, Isolation 95; 0 High.

**TEA:** Epic-level: test-design (E2) + trace PASS + NFR PASS-advisory + test-review 92/A. Per-story TEA: 3-1/3-3/3-4 high (atdd+automate), 3-2 medium (automate), 3-5 high (atdd+automate). Long-epic per-story trace advisory dormant (5-story epic < 6 threshold).

**UAT:**
1. -- A. Environment & preconditions --
2. 1. `supabase start` then `supabase db reset` -> applies CRM + settings + pricing migrations from empty, no error.
3. 2. `pnpm typecheck` -> clean (SnapshotSource readonly union; assertNever makes any unhandled source-kind a compile error).
4. 3. Sign in as the seeded tenant_admin (adminA) at /login -> lands in the app shell.
5. 4. Nav shows EXACTLY seven labels (Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Installningar); none of Pilotstod/Migrering/Fortnox/Leverantor/Uthyrning/Tillgangar; no standalone Prissattning.
6. -- B. CRM list/search/detail (3-2) --
7. 5-6. /customers -> h1 Kunder + Ny kund + table of both seeded customers; columns Kund/Typ/Org.nr/Ort/Status, Aktiv by check icon+text (not color), NO personnummer in list.
8. 7-10. Sok kund narrows by display name and by org.nr (556677-8899); nonsense -> distinct 'Inga traffar'; Filtrera typ Privatperson filters, reset returns both.
9. 11-13. Click name -> /customers/[id] (name h1 + badge); company detail shows Organisationsnummer, no personnummer field; private detail personnummer masked (last 4) + Visa/Dolj toggle.
10. 14-15. Company detail: Anlaggningar (facility) + Kontakter (contact) with Redigera/archive; Relaterat shows honest 'byggs i Epic N' placeholders, no deferred-module section.
11. -- C. CRM dialogs / a11y / lifecycle (3-2) --
12. 16-18. Ny kund dialog: focus lands on first field; Escape closes + returns focus to trigger; Tab wraps (focus trapped).
13. 19-22. Kundtyp Foretag->Organisationsnummer / Privatperson->Personnummer; missing org.nr -> field error + summary, input preserved; exact-name match -> non-blocking amber duplicate advisory; valid save appears in list.
14. 23-26. Redigera -> type read-only '(kundtyp kan inte andras)', fields pre-filled; Ny anlaggning / Ny kontakt dialogs open with focus + Escape returns; Arkivera kund -> leaves the active list.
15. -- D. Company settings + VAT defaults (3-3) --
16. 27-28. Installningar hub -> Foretagsinstallningar / Offertvillkor / Prissattning cards; /settings/company shows identity fields + Standardvisning av moms select + Momssats percent (helper: basis points, no VAT calc); NO logo_url control by design.
17. 29-32. Fresh tenant Momssats 25 + default VAT-display; save Foretagsnamn 'Elpro Pilot AB' + Momssats round-trips; 25.5 fractional preserved; VAT-display choice persists.
18. 33-35. Momssats 250 / abc / 25.555 rejected (field-associated); blank or spaces-only Foretagsnamn rejected (required); malformed E-post rejected.
19. 36. VAT-display options both state 'privatkunder visas alltid inkl. moms'; NO per-customer toggle, NO VAT/total/margin calculation.
20. -- E. Quote-terms sign-off lifecycle (3-3) --
21. 37-39. No terms -> amber 'Ej godkant' WARNING (not color-only), no green status; empty textarea rejected (required); save text -> 'Sparande godkanner inte villkoren' + WARNING persists; reload round-trips.
22. 40. 'Markera som godkand' -> green 'Godkand av agare/juridik (<date> UTC)' who+when; WARNING gone.
23. 41-42. Edit approved terms + save -> approval RE-INVALIDATED (WARNING returns, button reappears); re-approve -> green again.
24. -- F. Pricing work-roles/articles incl. archive/reactivate (3-4 + Tier-B fix) --
25. 43-45. /settings/pricing (Prissattning) with Arbetsroller + Artiklar sections + empty states; save role 850,00/600,00 -> '850,00 kr/tim' round-trips; 12,5->12,50; 0,01->0,01.
26. 46-48. Blank Kostnad defaults 0; Kostnad 'abc' blocked (field error, sell unaffected); Pris -5 / 850.00 / 850,005 / '850 kr' / '1.000,00' each blocked (Swedish comma, <=2 decimals); blank Benamning/Pris -> required errors; errors by text not color.
27. 49-50. Save article Kabel/m/12,50 -> 'Kabel (m)' 12,50 kr; sku+Enhet optional; -1/abc blocked; blank Artikelnamn required.
28. 51-53. Arkivera role/article -> leaves active list (persists on reload); 'Visa arkiverade (N)' -> Arkiverade section with 'Ateraktivera'; Ateraktivera -> returns to active list (reversible door). [Tier-B HIGH fix]
29. 54. Archive/reactivate FAILURE would paint a role=alert '*-archive-error' banner + 'Forsok igen.' on transient SERVER_ERROR (best-effort; no happy-path trigger — failure-path manual test deferred). [Tier-B MED fix]
30. 55. Whole /settings/pricing page: NO supplier/leverantor/sync/import/Fortnox/API/vendor/mapping field; NO VAT/total/margin/computed amount (source prices only).
31. -- G. Snapshot-source contract, test/command-level (3-5) --
32. 56-58. `pnpm test:unit` snapshot units: copy-fidelity (ore integer, vat_rate_bp basis points, nulls preserved); R-008 immutability (mutate source after build -> unchanged, Object.isFrozen); golden-master shape pinned.
33. 59. Golden fixtures work-role-source.json + article-source.json: stable shape, anonymized only (no real PII), article fixture has NO supplier key.
34. 60-61. `pnpm test:int` source-ownership: Tenant-A id resolves, Tenant-B id -> TENANT_ACCESS_DENIED (both layers, no existence leak); `verify:service-role-containment` passes.
35. -- H. CRM + isolation command/SQL checks (3-1), run once --
36. 62-63. `pnpm test:int` proves: 3 CRM tables with tenant ownership + same-tenant composite FKs + CHECKs; personnummer only on customers; NO supplier columns; RLS enabled+forced, own-tenant S/I/U + no DELETE policy; GRANTs (authed SIU, service_role full, anon none); H4 gate green.
37. 64-65. Commands: createCustomer writes exactly one customer.created audit row (no PII in metadata); validation VALIDATION_FAILED matrix; archive soft-deletes (BYPASSRLS row exists); cross-tenant parent-link/read/write denied (TENANT_ACCESS_DENIED / 42501 / RLS-invisible + BYPASSRLS unchanged); anon denied 42501.
38. -- I. Cross-cutting (browser) --
39. 66-68. Re-confirm seven nav; anon visits to /customers, /customers/<id>, /settings, /settings/company, /settings/quote-terms, /settings/pricing -> all redirect to /login; signed-in bad customer id -> generic 'Kunden hittades inte' (no existence leak).
40. 69-70. Sign in as adminB -> UI cross-tenant isolation holds across CRM/settings/pricing (only own-tenant data); spot-check no deferred-module labels, no supplier scope, no VAT calc engine anywhere in Epic 3.

**Overrides:** none

**Open questions:**
1. Personnummer for private customers: implemented per the 2026-06-18 owner sign-off (access-controlled, list-excluded, detail-masked). Confirm that sign-off is authoritative at PR review.
2. VAT rate value (basis points, default 2500) + default_vat_display enum precision - pending the Epic-4 working session.
3. Customer-facing quote-terms + tax/VAT wording - owner/accounting/legal sign-off REQUIRED before real pilot use (never auto-approved; captured as un-approved state only).
4. Exact mandatory company-identity + customer fields for a PDF-ready quote - owner-pending (Epic 6).
5. Articles in-scope for Epic 3 - implemented per the 2026-06-18 owner 'yes'; confirm at pilot.
6. Customer-type list + facility/contact requiredness + no-enforced-primary-contact - owner-decided defaults pending final sign-off.

**Deferred work:**
1. Epic 6 obligations: extend the CompanySettings snapshot variant with PDF-identity fields (org_nr/address/email/phone/logo_url); add a terms-approved send-gate marker so a future 'mark sent' checks approvedAt.
2. Full GDPR/retention treatment of personnummer (internal-pilot scope; storage + access-control only now).
3. Pricing-UI polish (Tier-B iter-2 Low): stale lifecycle-error banner across actions; no-op reactivate audit-noise; archived-read failure gating the whole page; failing-archive banner test coverage; E2E name-key -> crypto.randomUUID.
4. CRM: contact is_primary can't be unchecked / facility binding can't be cleared on edit (shared form-parser root); approved_by display-name resolution; empty-patch id-only update false TENANT_ACCESS_DENIED.
5. Several epic-1/2 test-quality Lows remain in deferred-work.md (kept-on-doubt at reconcile).
Reconcile: marked 2 e2e/Playwright-infra items resolved (the (app)-layout redirect assertion + the Playwright runner - both landed via the now-live e2e CI job). Archive: moved those 2 resolved entries -> deferred-work-resolved.md.

**Auto-decided (epic mode):**
1. AC1 duplicate-like surfaced only in create dialog, not a list state [Med] -> dismiss: Task 1.4 create-dialog placement is the sanctioned intent; AC1 met in spirit (non-blocking advisory present) (Tier A, 3-2-crm-tenant-admin-ux-and-lifecycle-context)
2. AC1 loading not a distinct rendered state [Med] -> dismiss: architecturally inapplicable given the server-read + client-filter design (no client fetch to await); 4/5 states explicit (Tier A, 3-2-crm-tenant-admin-ux-and-lifecycle-context)
3. Approved-status UI shows static 'agare/juridik' not real approved_by [Med] -> defer: attribution-by-name needs a user-display read surface out of scope; wire when a user-read lands (Tier A, 3-3-company-identity-quote-terms-and-vat-defaults)
4. default_vat_display enum drops 'private always incl-VAT' to a code invariant [Low] -> defer: precise enum owner-gated (Open Question 3), confirm at Epic-4 working session (Tier A, 3-3-company-identity-quote-terms-and-vat-defaults)
5. Articles-IN-scope is an owner assumption (Open Question 1), not independently re-confirmed [Low] -> defer: owner-gated, re-confirm at PR review; the articles slice is cleanly removable if reversed (Tier A, 3-4-work-roles-and-optional-manual-articles)
6. Personnummer clear-text in client-component payload (mask cosmetic) [Low] -> defer: admin-only own-tenant, security-cleared; server-gated reveal is an Epic 6 privacy-hardening item (deferred not dismissed for PII stewardship) (E_review, epic-3)
7. Epic-3 test-design 'no personnummer' exit-criteria vs shipped owner-approved schema [Low] -> defer: reconcile test-design/R-009 text to the 2026-06-18 owner decision, no code change (E_review, epic-3)
8. Archived-read failure gates the ENTIRE pricing page (introduced by the reactivate fix) [Low] -> defer: scope the archived-read error to the archived section, not page-level; future pricing-UI polish (E_review iter 2, epic-3)

**Planning drift:** DETAIL-LEVEL: test-design-epic-3.md R-009 + exit criteria 'no personnummer field by default' is superseded by the 2026-06-18 owner decision (personnummer required for private/ROT). Shipped correctly; only the test-design prose is stale. One-line doc reconciliation so a future automated trace does not spuriously FAIL. Non-blocking; recommend a docs update, not auto-run.

**⚠️ Needs human:**
1. Optional (non-blocking): merge the open PR when ready - the epic is already a clean completion; merging is the remaining human step.
2. Owner decision (overdue): the NFR CONCERNS (no pnpm-audit dependency-scan CI gate; no coverage reporter) have carried across epics 2 AND 3 - schedule them or formally accept-and-stop-reporting.
3. One-line doc fix: reconcile test-design-epic-3.md R-009 'no personnummer' wording to the 2026-06-18 owner decision (planning drift).
4. Confirm the owner sign-offs surfaced in Open questions (personnummer authority; VAT rate/wording legal sign-off; mandatory PDF fields; articles-in-scope) before real pilot use.

**Next:** Epic 4 (calculations / money-VAT-ROT engine) - the snapshot-source contract, integer-ore pricing, and approved settings from Epic 3 are its inputs. (No auto-start.)
