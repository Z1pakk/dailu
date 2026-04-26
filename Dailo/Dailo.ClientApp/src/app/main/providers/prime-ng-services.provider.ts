import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';

export const providePrimeNgServices = () => {
  return [DialogService, MessageService];
};
