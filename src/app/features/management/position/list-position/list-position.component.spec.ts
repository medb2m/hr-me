import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListPositionComponent } from './list-position.component';

describe('ListPositionComponent', () => {
  let component: ListPositionComponent;
  let fixture: ComponentFixture<ListPositionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPositionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListPositionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
