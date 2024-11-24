import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { StationListComponent } from './app/station-list/station-list.component';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

bootstrapApplication(StationListComponent, {
  providers: [provideAnimationsAsync()]
}).catch((err) =>
  console.error(err)
);
