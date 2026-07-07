# auto-bmad epic report log — epic-7

## Report — 2026-07-07T08:25:20Z (final)

**Epic:** `7` — 4 stories.
**Branch:** `epic/7-acceptance-to-job-transaction` (HEAD `f680c01`).
**Pipeline status:** ✅ clean completion — all 4 stories landed on one epic branch; Tier-B integration review converged Approve in 2 iterations (0 Crit/High); trace gate PASS; no draft-predicate clause fired pre-push (CI evaluated post-push, see chat report)
**Continues:** (none — first run)

**Summary:** Epic 7 'Acceptance-To-Job Transaction' delivers the full acceptance->job pipeline: 7-1 acceptance-evidence capture for sent quote versions (quote_acceptances/jobs/job_events schema + RLS + form), 7-2 the idempotent atomic accept_quote_and_create_job SECURITY INVOKER RPC + command + UI re-point + affordance gating, 7-3 the /jobs list + job detail with immutable source traceability and audited Phase A-safe edits, and 7-4 the fail-closed accepted-record immutability triggers (AR704/ACCEPTED_RECORD_LOCKED) + correction boundary. Three additive migrations (20260709/10/11). Final suite: 1126 unit, 641 INT/RLS, 15+ E2E - all green; typecheck/lint/build pass.

**Timing:** started 2026-07-06T17:50:12Z; completed in progress — elapsed 14h 35m (≈14h 22m AI-run, ≈13m human/idle wait).

**Stories:**
1. 1
2. .
3. 7
4. -
5. 1
6. a
7. c
8. c
9. e
10. p
11. t
12. a
13. n
14. c
15. e
16. -
17. e
18. v
19. i
20. d
21. e
22. n
23. c
24. e
25. -
26. c
27. a
28. p
29. t
30. u
31. r
32. e
33. -
34. f
35. o
36. r
37. -
38. s
39. e
40. n
41. t
42. -
43. q
44. u
45. o
46. t
47. e
48. -
49. v
50. e
51. r
52. s
53. i
54. o
55. n
56. s
57. -
58. r
59. e
60. v
61. i
62. e
63. w
64. ;
65. T
66. i
67. e
68. r
69. A
70. A
71. p
72. p
73. r
74. o
75. v
76. e
77. (
78. C
79. 0
80. /
81. H
82. 0
83. /
84. M
85. 1
86. /
87. L
88. 3
89. ,
90. 2
91. D
92. e
93. c
94. i
95. s
96. i
97. o
98. n
99. s
100. a
101. u
102. t
103. o
104. -
105. d
106. i
107. s
108. m
109. i
110. s
111. s
112. e
113. d
114. ,
115. 1
116. L
117. o
118. w
119. d
120. o
121. c
122. P
123. a
124. t
125. c
126. h
127. f
128. i
129. x
130. e
131. d
132. ,
133. 1
134. L
135. o
136. w
137. d
138. e
139. f
140. e
141. r
142. r
143. e
144. d
145. )
146. ;
147. s
148. e
149. c
150. u
151. r
152. i
153. t
154. y
155. 0
156. /
157. 0
158. /
159. 0
160. 2
161. .
162. 7
163. -
164. 2
165. i
166. d
167. e
168. m
169. p
170. o
171. t
172. e
173. n
174. t
175. -
176. a
177. c
178. c
179. e
180. p
181. t
182. -
183. q
184. u
185. o
186. t
187. e
188. -
189. a
190. n
191. d
192. -
193. c
194. r
195. e
196. a
197. t
198. e
199. -
200. j
201. o
202. b
203. -
204. c
205. o
206. m
207. m
208. a
209. n
210. d
211. -
212. r
213. e
214. v
215. i
216. e
217. w
218. ;
219. T
220. i
221. e
222. r
223. A
224. C
225. h
226. a
227. n
228. g
229. e
230. s
231. R
232. e
233. q
234. u
235. e
236. s
237. t
238. e
239. d
240. -
241. >
242. f
243. i
244. x
245. e
246. d
247. (
248. C
249. 0
250. /
251. H
252. 0
253. /
254. M
255. 1
256. /
257. L
258. 2
259. ,
260. M
261. e
262. d
263. p
264. _
265. c
266. o
267. m
268. m
269. a
270. n
271. d
272. _
273. a
274. t
275. d
276. e
277. a
278. d
279. -
280. a
281. r
282. g
283. r
284. e
285. m
286. o
287. v
288. e
289. d
290. ,
291. 2
292. L
293. o
294. w
295. s
296. d
297. e
298. f
299. e
300. r
301. r
302. e
303. d
304. )
305. ;
306. s
307. e
308. c
309. u
310. r
311. i
312. t
313. y
314. 0
315. /
316. 0
317. /
318. 2
319. -
320. L
321. O
322. W
323. (
324. n
325. o
326. n
327. -
328. r
329. e
330. a
331. c
332. h
333. a
334. b
335. l
336. e
337. )
338. 3
339. .
340. 7
341. -
342. 3
343. m
344. i
345. n
346. i
347. m
348. a
349. l
350. -
351. j
352. o
353. b
354. -
355. o
356. r
357. d
358. e
359. r
360. -
361. r
362. e
363. c
364. o
365. r
366. d
367. -
368. a
369. n
370. d
371. -
372. t
373. e
374. n
375. a
376. n
377. t
378. -
379. a
380. d
381. m
382. i
383. n
384. -
385. u
386. x
387. -
388. r
389. e
390. v
391. i
392. e
393. w
394. ;
395. T
396. i
397. e
398. r
399. A
400. A
401. p
402. p
403. r
404. o
405. v
406. e
407. (
408. C
409. 0
410. /
411. H
412. 0
413. /
414. M
415. 0
416. /
417. L
418. 2
419. b
420. o
421. t
422. h
423. d
424. e
425. f
426. e
427. r
428. r
429. e
430. d
431. ,
432. 4
433. n
434. o
435. i
436. s
437. e
438. d
439. i
440. s
441. m
442. i
443. s
444. s
445. e
446. d
447. )
448. ;
449. s
450. e
451. c
452. u
453. r
454. i
455. t
456. y
457. 0
458. /
459. 0
460. /
461. 0
462. 4
463. .
464. 7
465. -
466. 4
467. a
468. c
469. c
470. e
471. p
472. t
473. e
474. d
475. -
476. s
477. t
478. a
479. t
480. e
481. -
482. i
483. m
484. m
485. u
486. t
487. a
488. b
489. i
490. l
491. i
492. t
493. y
494. -
495. a
496. n
497. d
498. -
499. c
500. o
501. r
502. r
503. e
504. c
505. t
506. i
507. o
508. n
509. -
510. b
511. o
512. u
513. n
514. d
515. a
516. r
517. y
518. -
519. r
520. e
521. v
522. i
523. e
524. w
525. ;
526. T
527. i
528. e
529. r
530. A
531. A
532. p
533. p
534. r
535. o
536. v
537. e
538. (
539. C
540. 0
541. /
542. H
543. 0
544. /
545. M
546. 0
547. /
548. L
549. 1
550. d
551. o
552. c
553. p
554. a
555. t
556. c
557. h
558. f
559. i
560. x
561. e
562. d
563. i
564. n
565. -
566. p
567. a
568. s
569. s
570. )
571. ;
572. s
573. e
574. c
575. u
576. r
577. i
578. t
579. y
580. 0
581. /
582. 0
583. /
584. 0

**Skipped (already done):** (none — all 4 enumerated stories were backlog and ran fresh)

**Integration review:** Tier B (chunked 4 story sub-diffs x 6 lenses [blind/edge/auditor x ab-deep + ab-alt-deep] + whole-epic ab-security + joint triage, 2 iterations): iter 1 Approve C0/H0/M6/L10 surviving from ~190 raw findings (5 Patch + 1 fix-channel Decision fixed; security 0/0/0); iter 2 Approve C0/H0/M1/L6 new (1 Low docstring Patch fixed; security 0/0/0) -> gate exit-clean, CONVERGED, convergence_unverified=false. HITL halt: auto-continued (epic - no halt). 7 Decision items auto-resolved (see Auto-decided). Diff was 10,971 lines > the 6,000 chunk threshold, so the review ran chunked per story with one joint triage.

**Epic gate:** trace PASS (P0 100% 15/15, P1 100% 8/8, overall 100% 23/23 FULL; all 11 high-priority risks mitigated; 5 non-negotiable epic blockers met); NFR PASS-advisory (7 PASS / 1 CONCERNS - c8 coverage reporter, LOW since Epic 2); test-review 90/100 (A, Approve)

**TEA:** Epic test design verified+corrected pre-loop (sent-lock transition allow-list). Per-story: all 4 stories triaged HIGH → [atdd, automate] each; all ATDD scaffolds turned green in dev. Epic-end gates: trace PASS (P0 100% 15/15, P1 100% 8/8, overall 100% 23/23 FULL; all 11 high-priority risks mitigated), NFR PASS-advisory (7 PASS / 1 CONCERNS — the c8 coverage-reporter LOW carried since Epic 2), test-review 90/100 (A, Approve; 0 Critical, 1 High file-length advisory)

**UAT:**
1. SETUP: supabase start + supabase db reset (migrations 20260709/10/11 not on main/demo yet), pnpm dev; log in at /login as demo tenant_admin; keep a second tenant's admin creds for the cross-tenant negative; prepare a SENT quote version (draft -> line items -> mark-sent), a DRAFT version, and one uploaded own-tenant file id
2. On the SENT version at /quotes/<quoteId> -> 'Registrera acceptans' form renders Kanal, Accepterad (datum/tid), Jobbtitel (valfritt), Accepterat pris (kr), Bevisreferens (extern), Bevisfil (id), Planerad start, Planerat slut, Anteckningar; NO admin-user field (server-derived)
3. Select a DRAFT version -> 'Acceptans kan registreras när versionen är skickad.' and NO form
4. 'Accepterat pris (kr)' pre-filled with the frozen sent total; 'Skickat totalbelopp: <X> kr' beneath matches
5. Keyboard-only tab through the form -> visible focus ring in order, confirm reachable, outcome conveyed as TEXT
6. Happy path: keep price, set datum/tid, optional Jobbtitel, confirm -> transient 'Accepterad. Acceptansen är registrerad.' (role=status), then section flips to 'Denna version är accepterad. Ett jobb har skapats från den accepterade offerten.' with an 'Öppna jobbet' link
7. Reload the accepted version -> stable accepted text, no form, no error (idempotent landing)
8. On the accepted version -> 'Skapa ny version' button and PDF panel NOT mounted (also rejected server-side)
9. Fresh sent version: change price to differ -> amber 'Prisjustering' panel + required 'Motivering' field; confirm DISABLED until a reason is typed; then submit succeeds
10. Server re-validation: blank the adjustment_reason via devtools/crafted POST with non-zero delta -> generic VALIDATION_FAILED, acceptance NOT recorded
11. Free text in 'Bevisreferens (extern)', no file id -> succeeds; reference stored, no file link
12. Own-tenant file id in 'Bevisfil (id)' -> succeeds (evidence link created)
13. Random UUID / foreign tenant file id in 'Bevisfil (id)' -> red error (role=alert), generic message, acceptance NOT recorded (no existence disclosure)
14. Click 'Jobb/Order' in the nav -> /jobs list (no placeholder); the created job shows title/customer, 'Offert #...', planned start, status as TEXT
15. Scan /jobs + filters -> NO field-worker/schedule, time/material, deviation, ÄTA, analytics, invoice, supplier, or Fortnox surface anywhere
16. Filters Kund / Status / Källoffert / Planerat startdatum each narrow the list; combining two satisfies both; clearing restores
17. Tenant with no accepted quotes (or all rows filtered out) -> 'Inga jobb matchar. Jobb skapas när en offert accepteras.'
18. Job detail 'Ursprung och åtagande' -> clickable 'Källoffert (version)' link, frozen customer/facility/contact at acceptance, accepted price + original offertsumma in kronor, kanal/datum, adjustment reason if any — all read-only text
19. Click 'Källoffert (version)' -> lands on /quotes/[quoteId]/versions/[versionId]
20. Evidence: file case -> 'Öppna bevis' yields a time-limited 'Visa bevisfil' signed link that opens the file; reference case -> reference text, no button; both-present -> BOTH rendered (defensive fix)
21. 'Filer' lists job-linked files or 'Inga kopplade filer.' (no upload control); 'Händelser' lists events with Swedish labels + dates
22. 'Redigera jobb' dialog: focus lands in Titel; ONLY Titel/Status/Planerat start/Planerat slut; Status select has ONLY the four Phase-A values; Escape/Avbryt close without saving and restore focus
23. Change Status (or Titel/date) + Spara -> persists, status change appends an event; accepted price/source refs/evidence unchanged
24. Spara with no changes -> clean no-op, no error alert
25. Accepted job detail -> lock notice (role=note, data-testid=job-accepted-lock-notice): commitment 'låst', corrections need a 'godkänt granskat arbetsflöde'; TEXT not color, keyboard-reachable, NO action affordance
26. Scan the whole job detail -> NO edit control on any immutable field (price, totals, evidence, source version, timestamp, channel, source refs)
27. Accepted quote's acceptance section -> 'Öppna jobbet' lands on the single existing job; re-visits show the same one job, never a duplicate or second accept affordance
28. Visit /jobs/<random-or-foreign-jobId> -> generic 404, no existence indication
29. Cross-tenant: as tenant A admin, crafted accept with tenant B's version id -> generic TENANT_ACCESS_DENIED, no leak
30. Logged OUT, request /quotes/<quoteId> and /jobs/<jobId> directly -> redirected to /login; no public acceptance route
31. NOT hand-testable (automated INT/RLS): AC3 rollback (__faultInject), true concurrent accepts, exact DB row-count assertions, AR704 direct-SQL trigger rejection, smuggled-field command rejection

**Overrides:** none (epic mode itself, --epic 7)

**Open questions:**
1. Owner residuals re-confirmed, none blocking under demo-data-only: R-713 adjusted-price policy + accepted-evidence channel set (Sign-Off Q8), R-714 correction-workflow policy, R-716 per-person ROT cap carry
2. Whether acceptance-evidence files should ALSO appear under the job's Filer list (currently only via the dedicated evidence block) — traceability preference, not a defect

**Deferred work:**
1. Epic review deferrals (ledger, 'Deferred from: epic review of epic-7'): admin user not pinned to the locked row; DB XOR CHECK for evidence exclusivity; correction-attempt-rejected exit-criteria reconcile; QV409 distinct-SQLSTATE swap; fix-commit test coverage (QV409-orphan branch, JobEvidenceLink dual-render); 7.1↔7.3 evidence-file owner_type label seam; partial-patch planned-date ordering; jobs.facility_id/contact_id populated but never read back; readJobDetail sibling 0-kr fabrication; plus 5 cross-references to per-story deferrals
2. Per-story deferrals: zero-frozen source_sent_total_ore data-quality dependency on Epic 6 (7-1); parent-quotes not-found guard + divergent-input idempotent re-entry (7-2); readJobList dead server-side filters + createFileLink(owner_type=job) write path untested until 8.2 (7-3)
3. Epic-8.2 reconciliation items routed by the retrospective: link_existing_file/createFileLink split, draft->linked lifecycle-state gap, non-transactional PDF-metadata insert, job owner-type write-path proof
reconcile marked 1 missed completion (epic-6 affordance-gating carry — resolved in 7.2 Task 5: new-version.ts:80, generate-pdf.ts:198, QuoteDetailView !isAccepted gating); archived 2 resolved entries -> deferred-work-resolved.md (quote-number display ratified by owner decision D-1; the affordance-gating carry)

**Auto-decided (epic mode):**
1. Evidence link uses raw link_existing_file RPC, not createFileLink [Med] -> dismiss: manual path deliberate and correct (single audit row + foreign-file rejection preserved); ratify as-is (Tier A, 7-1)
2. Admin user captured only in audit trail, not on acceptance record [Low] -> dismiss: acting admin captured as server-derived audit actor; AC1 satisfied (Tier A, 7-1)
3. RPC never receives the p_command_at command-timestamp param [Med] -> fix: remove the dead adapter param + its unit assertion (Tier A, 7-2)
4. Admin user never pinned to the immutable acceptance/job row [Med] -> defer: actor lives on the append-only audit event; add accepted_by only if a real-customer/legal need surfaces (E_review, epic-7)
5. Evidence exclusivity file-XOR-reference unenforced; both-present dropped the reference on job detail [Med] -> fix: render BOTH fields in JobEvidenceLink; DB-XOR CHECK ledger-deferred (E_review, epic-7)
6. correction-attempt-rejected event promised by test-design but implemented by no story [Med] -> defer: reconcile the exit-criteria text to the shipped DB-trigger shape; flagged at the retro (E_review, epic-7)
7. QV409 orphan-assert surfaces as QUOTE_VERSION_LOCKED [Med] -> defer: unreachable on live path, net diagnosability gain; distinct SQLSTATE in the next additive accept-RPC migration (E_review iter 2, epic-7)

**Planning drift:** none — the retrospective found no PRD/architecture/epic-scope assumption Epic 7 proved wrong; Epic 8's planning already anticipates Epic 7's outputs (8.4 dependency named; 8.2 reconciliation items routed in the ledger)

**⚠️ Needs human:**
1. (optional, non-blocking) merge the epic PR on your own time — the merge prompt at the end of this run offers to do it
2. (optional) two review-process improvements flagged by the retro for the code-review checklist before Epic 8: new-code-for-new-conditions; fixes must carry their own tests

**Next:** story_plan.py would pick epic 8's next actionable story (Epic 8 'Files & Storage Hardening' wave 2) — preview only
