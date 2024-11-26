import { Component } from '@angular/core';
import { SkillService } from '../../../services/skill.service';
import { Skill } from '../../../models/skill';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-skill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './skill.component.html',
  styleUrl: './skill.component.css'
})
export class SkillComponent {
  skills: Skill[] = [];
  newSkillName: string = '';

  constructor(private skillService: SkillService) {}

  ngOnInit(): void {
    this.loadSkills();
  }

  loadSkills(): void {
    this.skillService.getAllSkills().subscribe((skills) => {
      this.skills = skills;
    });
  }

  addSkill(): void {
    if (this.newSkillName.trim()) {
      this.skillService.addSkill({ name: this.newSkillName }).subscribe((skill) => {
        this.skills.push(skill);
        this.newSkillName = '';
      });
    }
  }

  removeSkill(id: string): void {
    this.skillService.deleteSkill(id).subscribe(() => {
      this.skills = this.skills.filter((skill) => skill._id !== id);
    });
  }
}
