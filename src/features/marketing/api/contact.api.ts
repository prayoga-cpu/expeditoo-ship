import { api } from "@/lib/fetcher";
import type {
  ContactSubmitInput,
  ContactSubmitResult,
} from "@/server/dto/contact.dto";

export const contactApi = {
  submit: (input: ContactSubmitInput) =>
    api.post<ContactSubmitResult>("/api/contact", input),
};
