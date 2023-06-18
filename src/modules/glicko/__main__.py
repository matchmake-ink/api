from team import Team
from math import sqrt, pi, exp, log, fabs

# implementation of the glicko2 system detailed here:
# http://www.glicko.net/glicko/glicko2.pdf


class Glicko2:

    def __init__(self, calculating_team, opp_list, results_list):
        # system constants
        # constant value between 0.3 and 1.2 exclusive (lower value = more stable system)
        self.SYSTEM_CONSTANT = 0.3
        # constant value to handle convergence, defined by Glickman paper
        self.CONVERGENCE_TOLERANCE = 0.000001
        print(f"Constant: {self.SYSTEM_CONSTANT}")
        # variable values
        self.calculating_team = calculating_team
        self.calculating_team_phi = self.rating_score_to_phi(
            self.calculating_team.rating_score)
        self.calculating_team_mu = self.rating_to_mu(
            self.calculating_team.rating)
        self.opp_list = opp_list
        self.results_list = results_list

    def rating_to_mu(self, rating):
        return (rating - 1500) / 173.7178

    def rating_score_to_phi(self, rating_score):
        return rating_score/173.7178

    def g_function(self, phi):
        return 1 / (sqrt(1 + (3 * phi ** 2) / (pi ** 2)))

    def e_function(self, opp_mu, opp_g_function):
        return 1 / (1 + exp(-(opp_g_function) * (self.calculating_team_mu - opp_mu)))

    def f_function(self, input_val, estimated_improvement, variance):
        alpha = log(self.calculating_team.volatility ** 2)
        euler_component = exp(input_val)
        frac_one_numerator = euler_component * \
            (estimated_improvement ** 2 - self.calculating_team_phi **
             2 - variance - euler_component)
        frac_one_denominator = 2 * \
            ((self.calculating_team_phi ** 2 + variance + euler_component) ** 2)
        frac_two = (input_val - alpha) / self.SYSTEM_CONSTANT ** 2
        return (frac_one_numerator / frac_one_denominator) - frac_two

    def calibrate_initial_b_value(self, estimated_improvement, variance):
        alpha = log(self.calculating_team.volatility ** 2)
        if (estimated_improvement > self.calculating_team_phi ** 2 + variance):
            return log(estimated_improvement ** 2 - self.calculating_team_phi ** 2 - variance)

        k_val = 1
        while self.f_function(alpha - k_val * self.SYSTEM_CONSTANT, estimated_improvement, variance) < 0:
            k_val += 1
        return alpha - k_val * self.SYSTEM_CONSTANT

    # combining the estimated improvement and variance calculations is O(m) on matches, whereas separating is O(m + t)
    # small optimization I know, can separate for readability later
    def calculate_estimated_improvement_and_variance(self):
        inverse_variance = 0
        post_result_factor = 0
        for team_index in range(0, len(self.results_list)):
            # declare the opposing team and results list using given index
            opp_team = self.opp_list[team_index]
            results = self.results_list[team_index]

            # convert opposing team's rating_score and rating to glicko scale
            opp_phi = self.rating_score_to_phi(opp_team.rating_score)
            opp_mu = self.rating_to_mu(opp_team.rating)

            # calculate g and e functions given phi and mu
            opp_g_function = self.g_function(opp_phi)
            opp_e_function = self.e_function(opp_mu, opp_g_function)

            # calculate pre-result factors of estimated improvement (variance)
            inverse_variance += (opp_g_function ** 2) * \
                (opp_e_function) * (1-opp_e_function)

            # calculate post-result factor of estimated improvement
            for result in results:
                post_result_factor += opp_g_function * \
                    (result - opp_e_function)

        variance = 1 / inverse_variance
        estimated_improvement = variance * post_result_factor
        return [estimated_improvement, variance]

    def calculate_new_volatility(self, estimated_improvement, variance):
        A = log(self.calculating_team.volatility ** 2)
        B = self.calibrate_initial_b_value(estimated_improvement, variance)

        f_a = self.f_function(A, estimated_improvement, variance)
        f_b = self.f_function(B, estimated_improvement, variance)

        while (fabs(B - A) > self.CONVERGENCE_TOLERANCE):
            C = ((A - B) * f_a) / (f_b - f_a) + A
            f_c = self.f_function(C, estimated_improvement, variance)
            if f_c * f_b <= 0:
                A = B
                f_a = f_b
            else:
                f_a /= 2
            B = C
            f_b = f_c
        return exp(A / 2)

    def calculate_new_phi(self, new_volatility, variance):
        phi_star = sqrt(self.calculating_team_phi ** 2 + new_volatility ** 2)
        return 1 / sqrt(1 / (phi_star ** 2) + 1 / variance)

    def calculate_new_mu(self, new_phi):

        change_in_mu = 0
        for team_index in range(0, len(self.results_list)):
            # declare the opposing team and results list using given index
            opp_team = self.opp_list[team_index]
            results = self.results_list[team_index]

            # convert opposing team's rating_score and rating to glicko scale
            opp_phi = self.rating_score_to_phi(opp_team.rating_score)
            opp_mu = self.rating_to_mu(opp_team.rating)

            # calculate g and e functions given phi and mu
            opp_g_function = self.g_function(opp_phi)
            opp_e_function = self.e_function(opp_mu, opp_g_function)

            # add to delta mu
            for result in results:
                change_in_mu += opp_g_function * (result - opp_e_function)
        change_in_mu *= (new_phi ** 2)

        return self.calculating_team_mu + change_in_mu

    # main function, returns new rating, rating score, and volatility as a tuple
    def run_implementation(self):

        has_played_matches = (len(self.opp_list) != 0)
        if (not has_played_matches):
            new_phi = sqrt(self.calculating_team_phi ** 2 +
                           self.calculating_team.volatility ** 2)
            new_rating_score = 173.7178 * new_phi
            return [self.calculating_team.rating, new_rating_score, self.calculating_team.volatility]

        improvement_and_variance_pair = self.calculate_estimated_improvement_and_variance()
        estimated_improvement = improvement_and_variance_pair[0]
        variance = improvement_and_variance_pair[1]

        new_volatility = self.calculate_new_volatility(
            estimated_improvement, variance)
        new_phi = self.calculate_new_phi(new_volatility, variance)
        new_mu = self.calculate_new_mu(new_phi)

        # convert phi and mu to rating and rating score
        new_rating = 173.7178 * new_mu + 1500
        new_rating_score = 173.7178 * new_phi

        return [new_rating, new_rating_score, new_volatility]
