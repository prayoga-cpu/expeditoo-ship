/**
 * Where `/create` sends the requester once the server has the request
 * (request_posted_page_spec.md §1): a published or scheduled request to the
 * page that thanks them for it and says what happens next; a draft to their
 * requests, where it waits.
 */
export function postCreateDestination(
  job: { id: string },
  publish: boolean
): string {
  return publish ? `/create/success/${job.id}` : "/listings/me";
}
