import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    fetchDriverApplications,
    approveDriverApplication,
    rejectDriverApplication,
} from "../api/drivers.api";
import { toast } from "sonner";

export function useDriverApplications() {
    const queryClient = useQueryClient();

    const {
        data: applications = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ["driver-applications"],
        queryFn: fetchDriverApplications,
    });

    const approveMutation = useMutation({
        mutationFn: approveDriverApplication,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["driver-applications"] });
            queryClient.invalidateQueries({ queryKey: ["admin-drivers"] }); // Also refresh detailed driver list if needed
            toast.success("Application approved successfully");
        },
        onError: (error) => {
            toast.error(`Failed to approve: ${error.message}`);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: rejectDriverApplication,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["driver-applications"] });
            toast.success("Application rejected");
        },
        onError: (error) => {
            toast.error(`Failed to reject: ${error.message}`);
        },
    });

    return {
        applications,
        isLoading,
        error,
        approveApplication: approveMutation.mutate,
        rejectApplication: rejectMutation.mutate,
        isUpdating: approveMutation.isPending || rejectMutation.isPending,
    };
}
