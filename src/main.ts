import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { ReconsComponent } from './app/recons/recons.component';
import Swal from 'sweetalert2';


bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);

bootstrapApplication(ReconsComponent, appConfig).catch((err) =>
  console.error(err)
);
