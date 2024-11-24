import { Component, OnInit } from '@angular/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms'; // For [(ngModel)]

@Component({
  selector: 'app-station-list',
  standalone: true,
  imports: [
    HttpClientModule,
    DragDropModule,
    MatExpansionModule,
    MatIconModule,
    CommonModule,
    MatTooltipModule,
    FormsModule, // Two-way binding
    MatSelectModule, // For dropdowns
    MatOptionModule, // For mat-option
  ],
  templateUrl: './station-list.component.html',
  styleUrls: ['./station-list.component.css'],
})
export class StationListComponent implements OnInit {
  stations: any[] = []; // Original station list
  filteredStations: any[] = []; // Filtered station list for search
  searchQuery: string = ''; // Search query string
  preferredPosition: number | null = null; // Preferred position input
  programmeFilters: string[] = []; // Selected programmes for filtering
  validProgrammes: string[] = []; // List of unique, valid programmes

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any[]>('assets/data.json').subscribe((data) => {
      this.stations = data.map((station) => ({
        ...station,
        isFavorite: false, // Initialize favorite state as false
      }));
      this.filteredStations = [...this.stations]; // Initialize filteredStations
      this.extractValidProgrammes(); // Extract valid programmes for dropdown
  
      // Set default selections for programme filters
      this.programmeFilters = ['any', 'h103', 'a7'];
      this.filterStations(); // Apply the filters with default selections
    });
  }
  
  

  // Extract unique, valid programmes from the Discipline field
  extractValidProgrammes(): void {
    const programmesSet = new Set<string>(); // Use a set to avoid duplicates

    this.stations.forEach((station) => {
      const disciplines = station['Discipline']
        ?.toLowerCase()
        .split(',')
        .map((d: string) => d.trim());

      disciplines.forEach((discipline: string) => {
        if (discipline === 'any' || /^[a-z]\d{1,3}$/.test(discipline)) {
          programmesSet.add(discipline); // Add valid programme
        }
      });
    });

    this.validProgrammes = Array.from(programmesSet).sort(); // Convert to array and sort alphabetically
  }

  // Filter stations based on search query and selected programmes
  filterStations(): void {
    this.filteredStations = this.stations.filter((station) => {
      const disciplines = station['Discipline']
        ?.toLowerCase()
        .split(',')
        .map((d: string) => d.trim());
  
      const matchesQuery =
        !this.searchQuery ||
        station['Station Name']
          ?.toLowerCase()
          .includes(this.searchQuery.toLowerCase());
  
      const matchesProgramme =
        this.programmeFilters.length === 0 || // If no filters are selected, include all
        this.programmeFilters.some((filter) =>
          disciplines.includes(filter.toLowerCase())
        ) ||
        disciplines.includes('any'); // Match 'any' or selected programmes
  
      return matchesQuery && matchesProgramme;
    });
  
    // Add an updatedPosition field to each filtered station
    this.filteredStations.forEach((station) => {
      station.updatedPosition = this.getStationCurrentPosition(station['Station Id']);
    });
  }
  

  // Handle drag-and-drop event
  onDrop(event: CdkDragDrop<any[]>): void {
    const draggedStation = this.filteredStations[event.previousIndex];
    this.filteredStations.splice(event.previousIndex, 1); // Remove the dragged station
    this.filteredStations.splice(event.currentIndex, 0, draggedStation); // Insert it at the new position

    // Update the main stations list based on the new filtered order
    this.updateStationOrder();
  }

  // Clear the search query and reset the filtered list
  clearSearch(): void {
    this.searchQuery = ''; // Clear the search query
    this.filterStations(); // Reset the filtered list
    this.preferredPosition = null; // Clear the preferred position
  }

  // Save the station list as a PDF
  saveAsPDF(): void {
    const element = document.getElementById('station-list-container'); // Target the correct element
    if (!element) {
      console.error('Element not found for PDF export');
      return;
    }

    html2canvas(element, { scrollY: -window.scrollY }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png'); // Convert canvas to image
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add image to the first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add additional pages if content overflows
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('Station-Preferences.pdf'); // Save the PDF
    });
  }

  // Save the station list as a JSON file
  saveAsJSON(): void {
    // Create a filtered and ordered list based on the current state
    const orderedStations = [
      // Include all stations from the filtered list in their current order
      ...this.filteredStations.map((station, index) => ({
        Sequence: index + 1, // Add sequence based on current filtered order
        ...station,
      })),
      // Include all remaining stations (not in the filtered list or removed)
      ...this.stations
        .filter(
          (station) =>
            !this.filteredStations.some(
              (filteredStation) => filteredStation['Station Id'] === station['Station Id']
            )
        )
        .map((station) => ({
          Sequence: null, // No sequence for remaining stations
          ...station,
        })),
    ];
  
    // Remove the "removed" stations
    const finalStations = orderedStations.filter(
      (station) =>
        !this.favoriteStations.some(
          (favStation) => favStation['Station Id'] === station['Station Id'] && favStation.removed
        )
    );
  
    // Convert the ordered list to JSON
    const jsonString = JSON.stringify(finalStations, null, 2); // Pretty-printed JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
  
    // Trigger download of the JSON file
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Station-Preferences.json';
    a.click();
  
    // Revoke the URL to free memory
    window.URL.revokeObjectURL(url);
  
    alert('JSON saved successfully!');
  }
  

  // Update the main stations list based on the new filtered order
  updateStationOrder(): void {
    const orderedIds = this.filteredStations.map((station) => station['Station Id']);

    // Reorder the main stations list to match the filteredStations order
    this.stations.sort(
      (a, b) => orderedIds.indexOf(a['Station Id']) - orderedIds.indexOf(b['Station Id'])
    );
  }

  // Move a station to the top of the list
  moveStationToTop(stationId: string): void {
    if (!stationId) {
      alert('Station ID is missing or invalid.');
      return;
    }

    // Filter all stations with the same Station Id
    const sameIdStations = this.stations.filter(
      (station) => station['Station Id'] === stationId
    );

    if (sameIdStations.length === 0) {
      alert('No stations found with the given Station ID.');
      return;
    }

    // Remove all stations with the same Station Id from their current positions
    this.stations = this.stations.filter(
      (station) => station['Station Id'] !== stationId
    );

    // Add them to the top of the list
    this.stations.unshift(...sameIdStations);

    this.filterStations(); // Update the filteredStations
  }

  moveStationToPosition(): void {
    if (!this.searchQuery || this.preferredPosition === null) {
      alert('Please enter a station name and a preferred position.');
      return;
    }

    const stationIndex = this.stations.findIndex((station) =>
      station['Station Name']?.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    if (stationIndex === -1) {
      alert('Station not found.');
      return;
    }

    if (
      this.preferredPosition < 1 ||
      this.preferredPosition > this.stations.length
    ) {
      alert('Please enter a valid position.');
      return;
    }

    // Remove the station from its current position
    const [movedStation] = this.stations.splice(stationIndex, 1);

    // Insert it at the new position (adjusted for 0-based indexing)
    this.stations.splice(this.preferredPosition - 1, 0, movedStation);

    // Update filteredStations to reflect the new order in stations
    this.filteredStations = this.stations.filter((station) =>
      station['Station Name']?.toLowerCase().includes(this.searchQuery.toLowerCase())
    );

    alert('Position updated successfully!');
  }
  selectStation(name: string): void {
    if (!name) {
      alert('Invalid station name.');
      return;
    }
  
    // Update the search query with the selected station name
    this.searchQuery = name;
    this.filterStations(); // Filter the list based on the selected station name
  
    // Find the station index in the main stations array
    const stationIndex = this.stations.findIndex(
      (station) => station['Station Name'] === name
    );
  
    if (stationIndex !== -1) {
      // Set the preferred position to the current position (1-based index)
      this.preferredPosition = stationIndex + 1;
  
      // Enable position update field
      const station = this.filteredStations.find(
        (station) => station['Station Name'] === name
      );
      if (station) {
        station.updatedPosition = this.preferredPosition; // Prefill with current position
      }
  
      alert(`Selected station is at position ${this.preferredPosition}`);
    } else {
      alert('Station not found in the main list.');
    }
  }
  
  moveStationToBottom(stationId: string): void {
    if (!stationId) {
      alert('Station ID is missing or invalid.');
      return;
    }
  
    // Find the station in the list
    const stationIndex = this.stations.findIndex(
      (station) => station['Station Id'] === stationId
    );
  
    if (stationIndex === -1) {
      alert('Station not found.');
      return;
    }
  
    // Remove the station from its current position
    const [movedStation] = this.stations.splice(stationIndex, 1);
  
    // Add it to the end of the list
    this.stations.push(movedStation);
  
    // Update filteredStations to match the new order
    this.filteredStations = this.stations.filter((station) =>
      station['Station Name']?.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  
    // Ensure position update field is available only when the search query is active
    if (this.searchQuery) {
      this.filteredStations.forEach((station) => {
        station.updatedPosition = this.getStationCurrentPosition(station['Station Id']);
      });
    }
  
    alert('Station moved to the bottom successfully!');
  }

  
  showFavorites: boolean = false; // Toggle to show or hide the popup
favoriteStations: any[] = []; // List of favorite stations


// Close the favorites popup
closeFavoritesPopup(event?: MouseEvent): void {
  this.showFavorites = false; // Hide the popup
}



toggleFavorite(station: any): void {
  station.isFavorite = !station.isFavorite;

  if (station.isFavorite) {
    // Add to favorites and compute currentPosition
    station.currentPosition = this.getStationCurrentPosition(station['Station Id']);
    station.updatedPosition = station.currentPosition; // Sync updatedPosition with currentPosition
    this.favoriteStations.push(station);
  } else {
    // Remove from favorites
    this.favoriteStations = this.favoriteStations.filter(
      (favStation) => favStation['Station Id'] !== station['Station Id']
    );
  }
}

getStationCurrentPosition(stationId: string): number {
  // Find the station's position in the original stations array
  return this.stations.findIndex((station) => station['Station Id'] === stationId) + 1;
}

showFavoritesPopup(): void {
  this.showFavorites = true;

  // Update the currentPosition and updatedPosition for all favorite stations
  this.favoriteStations.forEach((station) => {
    station.currentPosition = this.getStationCurrentPosition(station['Station Id']);
    station.updatedPosition = station.currentPosition; // Ensure updatedPosition is set
  });
}

updateStationPosition(station: any): void {
  if (
    !station.updatedPosition ||
    station.updatedPosition < 1 ||
    station.updatedPosition > this.stations.length
  ) {
    alert('Please enter a valid position.');
    return;
  }

  const currentIndex = this.stations.findIndex(
    (s) => s['Station Id'] === station['Station Id']
  );

  if (currentIndex === -1) {
    alert('Station not found.');
    return;
  }

  // Remove the station from its current position
  const [movedStation] = this.stations.splice(currentIndex, 1);

  // Insert it at the new position
  this.stations.splice(station.updatedPosition - 1, 0, movedStation);

  // Update filtered stations
  this.filterStations();
  this.updateFavoriteStations();

  alert('Position updated successfully!');
}

updateFavoriteStations(): void {
  this.favoriteStations = this.stations.filter((station) => station.isFavorite);

  // Update currentPosition and updatedPosition for all favorites
  this.favoriteStations.forEach((station) => {
    station.currentPosition = this.getStationCurrentPosition(station['Station Id']);
    station.updatedPosition = station.currentPosition;
  });
}
removeStation(stationId: string): void {
  // Remove station from the main list
  this.stations = this.stations.filter(
    (station) => station['Station Id'] !== stationId
  );

  // Remove station from the favorites list if it exists
  this.favoriteStations = this.favoriteStations.filter(
    (station) => station['Station Id'] !== stationId
  );

  // Update filtered stations
  this.filterStations();

  alert('Station removed successfully!');
}
removeFromFavorites(station: any): void {
  // Unfavorite the station (set isFavorite to false)
  station.isFavorite = false;

  // Remove it from the favoriteStations list
  this.favoriteStations = this.favoriteStations.filter(
    (favStation) => favStation['Station Id'] !== station['Station Id']
  );

  // No changes to the main list; the station remains in stations
}


}
