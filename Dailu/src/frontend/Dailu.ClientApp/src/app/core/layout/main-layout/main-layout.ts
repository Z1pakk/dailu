import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MainSidebar } from '@layout/main-layout/main-sidebar/main-sidebar';
import { MainTopbar } from '@layout/main-layout/main-topbar/main-topbar';
import { MainFooter } from '@layout/main-layout/main-footer/main-footer';
import { MainSidebarService } from '@layout/services/main-sidebar.service';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, MainSidebar, MainTopbar, MainFooter],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  host: {
    '[class.layout-menu-inactive]': '!$isMenuOpened()',
  },
})
export class MainLayout {
  private readonly _mainSidebarService = inject(MainSidebarService);

  protected readonly $isMenuOpened = computed(() =>
    this._mainSidebarService.$isMenuOpened(),
  );
}
