/**
 * @file This file was originally written by Jerico Calago in Python, but has been rewritten in TypeScript by Jonathan Deiss (and Github Copilot).
 *       All credit for the actual implementation goes to Jerico.
 * @author Jonathan Deiss <jdeiss06@gmail.com>
 * @license GPL-3.0
 */
class Team {
  name: string;
  rating: number;
  rd: number;
  vol: number;

  constructor(name: string, rating: number, rd: number, vol: number) {
    this.name = name;
    this.rating = rating;
    this.rd = rd;
    this.vol = vol;
  }

  toString() {
    return `${this.name} (${this.rating}, ${this.rd}, ${this.vol})`;
  }
}

// This entire class is copied and pasted from Github Copilot
class Glicko2 {
  readonly SYSTEM_CONSTANT: number = 0.3;
  readonly CONVERGENCE_TOLERANCE: number = 0.000001;

  private calculating_team: any;
  private calculating_team_phi: number;
  private calculating_team_mu: number;
  private opp_list: any[];
  private results_list: any[];

  constructor(calculating_team: any, opp_list: any[], results_list: any[]) {
    console.log(`Constant: ${this.SYSTEM_CONSTANT}`);
    this.calculating_team = calculating_team;
    this.calculating_team_phi = this.rating_score_to_phi(
      this.calculating_team.rating_score
    );
    this.calculating_team_mu = this.rating_to_mu(this.calculating_team.rating);
    this.opp_list = opp_list;
    this.results_list = results_list;
  }

  private rating_to_mu(rating: number): number {
    return (rating - 1500) / 173.7178;
  }

  private rating_score_to_phi(rating_score: number): number {
    return rating_score / 173.7178;
  }

  private g_function(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
  }

  private e_function(opp_mu: number, opp_g_function: number): number {
    return (
      1 / (1 + Math.exp(-opp_g_function * (this.calculating_team_mu - opp_mu)))
    );
  }

  private f_function(
    input_val: number,
    estimated_improvement: number,
    variance: number
  ): number {
    const alpha = Math.log(this.calculating_team.volatility ** 2);
    const euler_component = Math.exp(input_val);
    const frac_one_numerator =
      euler_component *
      (estimated_improvement ** 2 -
        this.calculating_team_phi ** 2 -
        variance -
        euler_component);
    const frac_one_denominator =
      2 * (this.calculating_team_phi ** 2 + variance + euler_component) ** 2;
    const frac_two = (input_val - alpha) / this.SYSTEM_CONSTANT ** 2;
    return frac_one_numerator / frac_one_denominator - frac_two;
  }

  private calibrate_initial_b_value(
    estimated_improvement: number,
    variance: number
  ): number {
    const alpha = Math.log(this.calculating_team.volatility ** 2);
    if (estimated_improvement > this.calculating_team_phi ** 2 + variance) {
      return Math.log(
        estimated_improvement ** 2 - this.calculating_team_phi ** 2 - variance
      );
    }

    let k_val = 1;
    while (
      this.f_function(
        alpha - k_val * this.SYSTEM_CONSTANT,
        estimated_improvement,
        variance
      ) < 0
    ) {
      k_val += 1;
    }
    return alpha - k_val * this.SYSTEM_CONSTANT;
  }

  private calculate_estimated_improvement_and_variance(): [number, number] {
    let inverse_variance = 0;
    let post_result_factor = 0;
    for (
      let team_index = 0;
      team_index < this.results_list.length;
      team_index++
    ) {
      const opp_team = this.opp_list[team_index];
      const results = this.results_list[team_index];
      const opp_phi = this.rating_score_to_phi(opp_team.rating_score);
      const opp_mu = this.rating_to_mu(opp_team.rating);
      const opp_g_function = this.g_function(opp_phi);
      const opp_e_function = this.e_function(opp_mu, opp_g_function);
      inverse_variance +=
        opp_g_function ** 2 * opp_e_function * (1 - opp_e_function);
      for (const result of results) {
        post_result_factor += opp_g_function * (result - opp_e_function);
      }
    }
    const variance = 1 / inverse_variance;
    const estimated_improvement = variance * post_result_factor;
    return [estimated_improvement, variance];
  }

  private calculate_new_volatility(
    estimated_improvement: number,
    variance: number
  ): number {
    let A = Math.log(this.calculating_team.volatility ** 2);
    let B = this.calibrate_initial_b_value(estimated_improvement, variance);
    let f_a = this.f_function(A, estimated_improvement, variance);
    let f_b = this.f_function(B, estimated_improvement, variance);
    while (Math.abs(B - A) > this.CONVERGENCE_TOLERANCE) {
      const C = ((A - B) * f_a) / (f_b - f_a) + A;
      const f_c = this.f_function(C, estimated_improvement, variance);
      if (f_c * f_b <= 0) {
        A = B;
        f_a = f_b;
      } else {
        f_a /= 2;
      }
      B = C;
      f_b = f_c;
    }
    return Math.exp(A / 2);
  }

  private calculate_new_phi(new_volatility: number, variance: number): number {
    const phi_star = Math.sqrt(
      this.calculating_team_phi ** 2 + new_volatility ** 2
    );
    return 1 / Math.sqrt(1 / phi_star ** 2 + 1 / variance);
  }

  private calculate_new_mu(new_phi: number): number {
    let change_in_mu = 0;
    for (
      let team_index = 0;
      team_index < this.results_list.length;
      team_index++
    ) {
      const opp_team = this.opp_list[team_index];
      const results = this.results_list[team_index];
      const opp_phi = this.rating_score_to_phi(opp_team.rating_score);
      const opp_mu = this.rating_to_mu(opp_team.rating);
      const opp_g_function = this.g_function(opp_phi);
      const opp_e_function = this.e_function(opp_mu, opp_g_function);
      for (const result of results) {
        change_in_mu += opp_g_function * (result - opp_e_function);
      }
      change_in_mu *= new_phi ** 2;
    }
    return this.calculating_team_mu + change_in_mu;
  }

  public run_implementation(): [number, number, number] {
    const has_played_matches = this.opp_list.length !== 0;
    if (!has_played_matches) {
      const new_phi = Math.sqrt(
        this.calculating_team_phi ** 2 + this.calculating_team.volatility ** 2
      );
      const new_rating_score = 173.7178 * new_phi;
      return [
        this.calculating_team.rating,
        new_rating_score,
        this.calculating_team.volatility,
      ];
    }
    const improvement_and_variance_pair =
      this.calculate_estimated_improvement_and_variance();
    const estimated_improvement = improvement_and_variance_pair[0];
    const variance = improvement_and_variance_pair[1];
    const new_volatility = this.calculate_new_volatility(
      estimated_improvement,
      variance
    );
    const new_phi = this.calculate_new_phi(new_volatility, variance);
    const new_mu = this.calculate_new_mu(new_phi);
    const new_rating = 173.7178 * new_mu + 1500;
    const new_rating_score = 173.7178 * new_phi;
    return [new_rating, new_rating_score, new_volatility];
  }
}
