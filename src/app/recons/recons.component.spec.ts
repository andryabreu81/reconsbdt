import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReconsComponent } from './recons.component';

describe('ReconsComponent', () => {
  let component: ReconsComponent;
  let fixture: ComponentFixture<ReconsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReconsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReconsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
