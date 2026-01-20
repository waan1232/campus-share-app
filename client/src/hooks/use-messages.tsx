const sendMessage = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/messages", data);
      return res.json();
    },
    onSuccess: () => {
      // Force refresh of the messages list
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });
