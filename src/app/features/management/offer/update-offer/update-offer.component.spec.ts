import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateOfferComponent } from './update-offer.component';

describe('UpdateOfferComponent', () => {
  let component: UpdateOfferComponent;
  let fixture: ComponentFixture<UpdateOfferComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateOfferComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UpdateOfferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
