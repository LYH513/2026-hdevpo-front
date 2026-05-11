import { QUERY_KEYS } from '@/constants/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { postPortfolioCvGenerateHtml } from '../apis/cv';

const usePostPortfolioCvGenerateHtmlMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Parameters<typeof postPortfolioCvGenerateHtml>[1];
    }) => postPortfolioCvGenerateHtml(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.portfolioCv] });
    },
  });
};

export default usePostPortfolioCvGenerateHtmlMutation;
