# Documents selected-link contract preparation handoff

Current lane: contract-design preparation on `codex/documents-selected-link-contract-preparation`, based on `42f5cf60d1ded6d814c2c0f61b70b312144ce10e`. Implementation admission remains blocked.

PR90 already integrated the three-story backlog registration at that base. Actual canonical enumeration confirms all three authorized E20 keys/titles remain backlog, count three, with 20.1 first=true, last=false, after=2. Registration is not a pending merge prerequisite. registration.json preserves its earlier evidence with explicit historical labels; registration.patch must not be applied twice.

The current preparation PR concerns the selected-link contract design and its review evidence. The High author owns specification and contract content; the independent reviewer owns the audit; the coordinator owns admission and current spec/review pins. Consult admission.json for the current revision and unresolved gates. The former `7e475bfd42adc41e61fc4ccba5f399a7816025fdf37ad89d12d299c1aba489ab` spec hash is historical registration provenance.

Coordinator-only merge prerequisites for the current contract-preparation PR:

- Complete independent review of the final contract-preparation revision and reconcile its exact pin in admission records.
- Identify the exact pushed PR head and verify required CI at that head.
- Confirm the diff remains the authorized preparation scope, without product implementation, schema/migrations, dependencies/environment, module activation or ready promotion.
- Perform the authorized merge serially. A preparation merge does not approve implementation.

Remaining implementation gates are recorded by the coordinator and High author: oracle disposition, checked-contract review, checkpoint closure, exact ownership, fresh-base validation and validated admission. This reconciliation does not close them, interpret the source-authority contract, start a worker or claim, or change implementation authorization.

Coordinator-verified integrated upstreams: PR86 `8a7debbee83c9a4f6eb8ec4496ba2f7ad7db4b4b`; PR87 `7db3ded1e903131122eedbf9abd27548bc9c3375`; PR88 `7da9e8f3b63ffe6ed243f3f9ecc413fb56fe25a7`; PR89 `23c48b34c8a6c9158eeaf0edfca74e628d575cbc`; PR90 `42f5cf60d1ded6d814c2c0f61b70b312144ce10e`. Historical reservations and failures remain provenance rather than current blocking claims; ownership and contract validation still require their recorded dispositions.
