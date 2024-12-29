

export type TimeObject = {
  time: number
  days: number
  years: number
  minutesInDay: number
  daysInYear: number
}

export class Time {
  private time: number
  private days: number
  private years: number
  private fullDayMinutes: number
  private fullDaySeconds: number
  private daysInYear: number

  constructor(time: TimeObject = { time: 0, days: 0, years: 0, minutesInDay: 15, daysInYear: 365 }) {
    this.time = time.time
    this.days = time.days
    this.years = time.years
    this.fullDayMinutes = time.minutesInDay
    this.fullDaySeconds = time.minutesInDay * 60
    this.daysInYear = time.daysInYear
  }

  update (timeStep: number) {
    this.time += timeStep
    if (this.time >= this.fullDaySeconds) {
      this.time -= this.fullDaySeconds
      this.days++
    }
    if (this.days >= this.daysInYear) {
      this.days -= this.daysInYear
      this.years++
    }
  }

  get timeObject(): TimeObject { 
    return { time: this.time, days: this.days, years: this.years, minutesInDay: this.fullDayMinutes, daysInYear: this.daysInYear }
  }

  getTime() {
    return this.time
  }

  getDays() {
    return this.days
  }

  getYears() {
    return this.years
  }

  getFullDayMinutes() {
    return this.fullDayMinutes
  }

  getFullDaySeconds() { 
    return this.fullDaySeconds
  }

  getDaysInYear() {
    return this.daysInYear
  }
}