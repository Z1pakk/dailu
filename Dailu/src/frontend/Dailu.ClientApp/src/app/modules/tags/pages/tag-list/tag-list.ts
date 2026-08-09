import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { DataView } from 'primeng/dataview';
import { Store } from '@ngxs/store';
import { DialogService } from 'primeng/dynamicdialog';
import { TagFetchTags } from '../../state/tag.action';
import { TagStateSelectors } from '../../state/tag.selector';
import { TagAdd } from '../tag-add/tag-add';
import { TagAddModalFooter } from '../tag-add/tag-add-modal-footer';
import { TagAddModelData } from '../tag-add/type/tag-add-modal.type';

@Component({
  selector: 'app-tag-list',
  imports: [Button, DataView],
  templateUrl: './tag-list.html',
  styleUrl: './tag-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagList implements OnInit {
  private readonly _store = inject(Store);
  private readonly _dialogService = inject(DialogService);

  protected readonly $tags = this._store.selectSignal(
    TagStateSelectors.getSlices.tags,
  );

  ngOnInit() {
    this._store.dispatch(new TagFetchTags());
  }

  protected addTag() {
    this._dialogService.open<TagAdd, TagAddModelData>(TagAdd, {
      header: 'Create a new tag',
      width: '40rem',
      modal: true,
      closable: true,
      dismissableMask: false,
      keepInViewport: true,
      data: <TagAddModelData>{ $isFormValid: signal(false) },
      templates: {
        footer: TagAddModalFooter,
      },
    });
  }
}
